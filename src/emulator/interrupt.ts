import { ProcessedInstructionOptions } from "./armInstructionProcessors";
import { CPU, OperatingModeCodes, OperatingModes, Reg } from "./cpu";
import { byteArrayToInt32, int16ToByteArray } from "./math";

type Interrupt =
    "V_Blank" | "H_Blank" | "V_Counter_Match" | "Timer_0_Overflow" |
    "Timer_1_Overflow" | "Timer_2_Overflow" | "Timer_3_Overflow" |
    "Serial" | "DMA_0" | "DMA_1" | "DMA_2" | "DMA_3" | "Keypad" |
    "Game_Pak";

const InterruptEnableIndex = {
    "V_Blank": 0,
    "H_Blank": 1,
    "V_Counter_Match": 2,
    "Timer_0_Overflow": 3,
    "Timer_1_Overflow": 4,
    "Timer_2_Overflow": 5,
    "Timer_3_Overflow": 6,
    "Serial": 7,
    "DMA_0": 8,
    "DMA_1": 9,
    "DMA_2": 10,
    "DMA_3": 11,
    "Keypad": 12,
    "Game_Pak": 13,
};

const InterruptRegisters = {
    MasterEnable: 0x04000208,
    Enable: 0x04000200,
    RequestAckFlags: 0x04000202,
};

const IRQVectorAddress = 0x00000018;

const interruptsEnabled = (cpu: CPU) : boolean => {
    const masterEnabled = (cpu.memory.getInt8(InterruptRegisters.MasterEnable).value & 0x1) === 1;
    const cpsrIFlag = (cpu.getStatusRegister("CPSR") >> 7) & 0x1;
    return masterEnabled && cpsrIFlag === 0;
}

const requestInterrupt = (cpu: CPU, interrupt: Interrupt) : void => {
    let interruptEnable = cpu.memory.getInt16(InterruptRegisters.Enable).value;
    interruptEnable |= (1 << InterruptEnableIndex[interrupt]);
    cpu.memory.setBytesForInterrupt(InterruptRegisters.RequestAckFlags, int16ToByteArray(interruptEnable, false));
}

const handleInterrupts = (cpu: CPU, instructionOptions: ProcessedInstructionOptions) : boolean => {
    if (!interruptsEnabled(cpu)) return false;

    const interruptEnable = cpu.memory.getInt16(InterruptRegisters.Enable).value;
    if (interruptEnable === 0x0) return false;

    let interruptRequested = false;
    const requestFlags = cpu.memory.getInt16(InterruptRegisters.RequestAckFlags).value;
    if (requestFlags === 0x0) return false;

    for (let i = 0; i <= 13; i++) {
        if (((interruptEnable >> i) & 0x1) === 0) {
            continue;
        }

        if (((requestFlags >> i) & 0x1) === 1) {
            interruptRequested = true;

            // Set return address in LR_irq
            const nextInstructionAddress = cpu.getGeneralRegister(Reg.PC) -
                cpu.instructionSize * 2 +
                (instructionOptions.incrementPC ? cpu.instructionSize : 0);
            cpu.generalRegisters[OperatingModes.irq][Reg.LR] = nextInstructionAddress;

            // Save CPSR into SPSR_irq
            cpu.statusRegisters[OperatingModes.irq][1] = cpu.currentStatusRegisters[0];

            // Enter ARM IRQ mode
            cpu.setModeBits(OperatingModeCodes.irq);
            cpu.setStatusRegisterFlag('t', 0);

            // Disable normal interrupts
            cpu.currentStatusRegisters[0] |= 0x80;

            // Jump to IRQ vector
            cpu.setGeneralRegister(Reg.PC, IRQVectorAddress + 8);

            break;
        }
    }

    return interruptRequested;
}

const handleInterruptAcknowledge = (cpu: CPU, address: number, bytes: Uint8Array) : boolean => {
    if (bytes.length === 1) {
        // Writing single byte
    } else if (bytes.length === 2) {
        // Writing half word
        switch (address) {
            // IF: Interrupt request flags / IRQ acknowledge
            // Any bits that are being set to 1 should be instead set to 0.
            case 0x04000202:
                const ifRegister = cpu.memory.getInt16(address).value;
                const value = bytes[0] + (bytes[1] << 8);
                const result = ifRegister & ~value;
                cpu.memory.setBytesForInterrupt(address, int16ToByteArray(result, false));
                return true;
        }
    } else if (bytes.length === 4) {
        // Writing word
    }

    return false;
}

export { handleInterrupts, requestInterrupt, handleInterruptAcknowledge, InterruptRegisters }
