import { CPU } from "./cpu";
import { requestInterrupt } from "./interrupt";
import { getCachedIORegister } from "./ioCache";
import { PPUStepFlags } from "./ppu";

const MAX_CHANNEL = 3;
const DMA_REGISTERS = {
    SOURCE: [
        0x040000B0,
        0x040000BC,
        0x040000C8,
        0x040000D4,
    ],
    DESTINATION: [
        0x040000B4,
        0x040000C0,
        0x040000CC,
        0x040000D8,
    ],
    WORD_COUNT: [
        0x040000B8,
        0x040000C4,
        0x040000D0,
        0x040000DC,
    ],
    CONTROL: [
        0x040000BA,
        0x040000C6,
        0x040000D2,
        0x040000DE,
    ]
};

/**
 * These arrays hold the address offsets in bytes after each
 * DMA transfer.
 * 
 * First index is the transfer size, 0 = halfword, 1 = word.
 * Second index is the adjustment encoding bits of the DMA Control
 * register. 0 = increment, 1 = decrement, 2 = none, 3 = increment
 * with reset.
 */
const AddressDeltas = [
    [ 2, -2, 0, 2 ],
    [ 4, -4, 0, 4 ],
];

const DMAState = {
    enabled: [false, false, false, false],
    currentSourceAddress: [0, 0, 0, 0],
    currentDestinationAddress: [0, 0, 0, 0],
    wordCount: [0, 0, 0, 0],
};

const executeDMAs = (cpu: CPU, ppuFlags: PPUStepFlags) : void => {
    for (let channel = 0; channel <= MAX_CHANNEL; channel++) {
        const dmaControl = getCachedIORegister(DMA_REGISTERS.CONTROL[channel]);
        const enabled = (dmaControl & 0x8000) !== 0;

        if (!enabled) {
            DMAState.enabled[channel] = false;
            continue;
        }

        const repeatedDMA = DMAState.enabled[channel];

        if (repeatedDMA) {
            // This is a repeated DMA. Only the word count value and optionally the destination address
            // (if Increment+Reload mode is used) are reloaded.
            DMAState.wordCount[channel] = getCachedIORegister(DMA_REGISTERS.WORD_COUNT[channel]);

            if (((dmaControl >> 5) & 0x3) === 0x3) {
                DMAState.currentDestinationAddress[channel] = getCachedIORegister(DMA_REGISTERS.DESTINATION[channel]) & 0x07FFFFFF;
            }
        }
        else {
            // A fresh DMA: channel was disabled on previous step, but now is enabled. Reloading source,
            // destination, and word count values.
            DMAState.currentSourceAddress[channel] = getCachedIORegister(DMA_REGISTERS.SOURCE[channel]) & 0x0FFFFFFF;
            DMAState.currentDestinationAddress[channel] = getCachedIORegister(DMA_REGISTERS.DESTINATION[channel]) & 0x07FFFFFF;
            DMAState.wordCount[channel] = getCachedIORegister(DMA_REGISTERS.WORD_COUNT[channel]) >>> 0;

            DMAState.enabled[channel] = true;
        }

        const timingMode = (dmaControl >> 12) & 0x3;
        switch (timingMode) {
            case 0:
                // Immediate transfer
                executeTransfer(cpu, channel, dmaControl);
                break;
            case 1:
                // Execute on VBlank
                if (ppuFlags.vBlank) {
                    executeTransfer(cpu, channel, dmaControl);
                }
                break;
            case 2:
                // Execute on HBlank
                if (ppuFlags.hBlank) {
                    executeTransfer(cpu, channel, dmaControl);
                }
                break;
            case 3:
                // Special?
                // console.warn("DMA timing mode 3 not implemented.");
                break;
        }
    }
}

const executeTransfer = (cpu: CPU, channel: number, dmaControl: number) : void => {
    // TODO: restrict memory access based on DMA number

    const destinationAdjustment = (dmaControl >> 5) & 0x3;
    const sourceAdjustment = (dmaControl >> 7) & 0x3;
    const repeat = ((dmaControl >> 9) & 0x1) === 1;
    const transferSize = ((dmaControl >> 10) & 0x1);
    const timingMode = (dmaControl >> 12) & 0x3;
    const raiseIrq = (dmaControl >> 14) & 0x1;

    const halfwordTransfer = transferSize === 0;

    let currentSourceAddress = DMAState.currentSourceAddress[channel];
    let currentDestinationAddress = DMAState.currentDestinationAddress[channel];

    let destinationAddressDelta = AddressDeltas[transferSize][destinationAdjustment];
    let sourceAddressDelta = AddressDeltas[transferSize][sourceAdjustment];

    for (let i = 0; i < DMAState.wordCount[channel]; i++) {
        if (halfwordTransfer) {
            cpu.memory.setInt16(currentDestinationAddress, cpu.memory.getInt16(currentSourceAddress).value);
        } else {
            cpu.memory.setInt32(currentDestinationAddress, cpu.memory.getInt32(currentSourceAddress).value);
        }

        currentSourceAddress += sourceAddressDelta;
        currentDestinationAddress += destinationAddressDelta;
    }

    DMAState.currentSourceAddress[channel] = currentSourceAddress;
    DMAState.currentDestinationAddress[channel] = currentDestinationAddress;

    if (!repeat) {
        // Disable this DMA channel since transfer has completed.
        const newDMAControl = dmaControl & 0x7FFF;
        cpu.memory.setInt16(DMA_REGISTERS.CONTROL[channel], newDMAControl);
        DMAState.enabled[channel] = false;
    }

    if (raiseIrq) {
        if (channel === 0) requestInterrupt(cpu, "DMA_0");
        else if (channel === 1) requestInterrupt(cpu, "DMA_1");
        else if (channel === 2) requestInterrupt(cpu, "DMA_2");
        else if (channel === 3) requestInterrupt(cpu, "DMA_3");
    }
}

export { executeDMAs };
