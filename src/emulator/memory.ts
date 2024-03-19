import { CPU } from "./cpu";
import { handleInterruptAcknowledge, handleInterruptStore } from "./interrupt";

type MemorySegment = 'BIOS' | 'WRAM_O' | 'WRAM_I' | 'IO' | 'PALETTE' | 'VRAM' | 'OAM' | 'ROM_WS0' | 'ROM_WS1' | 'ROM_WS2' | 'SRAM';
type MemoryAccess = { nSeq16: number, seq16: number, nSeq32: number, seq32: number };
const segmentsByIndex: MemorySegment[] = ['BIOS', 'WRAM_O', 'WRAM_I', 'IO', 'PALETTE', 'VRAM', 'OAM', 'ROM_WS0', 'ROM_WS0', 'ROM_WS1', 'ROM_WS1', 'ROM_WS2', 'ROM_WS2', 'SRAM'];
const segments: {[key in MemorySegment]: {[key in 'start' | 'end']: number}} = {
    BIOS:     { start: 0x00000000, end: 0x00003FFF },
    WRAM_O:   { start: 0x02000000, end: 0x0203FFFF },
    WRAM_I:   { start: 0x03000000, end: 0x03007FFF },
    IO:       { start: 0x04000000, end: 0x040003FE },
    PALETTE:  { start: 0x05000000, end: 0x050003FF },
    VRAM:     { start: 0x06000000, end: 0x06017FFF },
    OAM:      { start: 0x07000000, end: 0x070003FF },
    ROM_WS0:  { start: 0x08000000, end: 0x09FFFFFF },
    ROM_WS1:  { start: 0x0A000000, end: 0x0BFFFFFF },
    ROM_WS2:  { start: 0x0C000000, end: 0x0DFFFFFF },
    SRAM:     { start: 0x0E000000, end: 0x0E00FFFF }
};
const waitStateCycles: {[key in MemorySegment]: MemoryAccess} = {
    BIOS:    { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    WRAM_O:  { nSeq16: 2, seq16: 2, nSeq32: 5, seq32: 5 },
    WRAM_I:  { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    IO:      { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    PALETTE: { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    VRAM:    { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    OAM:     { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    ROM_WS0: { nSeq16: 2, seq16: 2, nSeq32: 4, seq32: 4 },
    ROM_WS1: { nSeq16: 4, seq16: 4, nSeq32: 8, seq32: 8 },
    ROM_WS2: { nSeq16: 4, seq16: 4, nSeq32: 8, seq32: 8 },
    SRAM:    { nSeq16: 4, seq16: 4, nSeq32: 8, seq32: 8 },
};

interface MemoryType {
    memoryBlocks: {[key in MemorySegment]: Uint8Array}
    reset: () => void
    getSegment: (address: number) => MemorySegment
    getBytes: (address: number, bytes: number) => Uint8Array
    getInt8: (address: number) => MemoryReadResult
    getInt16: (address: number) => MemoryReadResult
    getInt32: (address: number) => MemoryReadResult
    setBytes: (address: number, data: Uint8Array) => MemoryWriteResult
    loadROM: (rom: Uint8Array) => void
};

interface MemoryReadResult {
    value: number,
    cycles: number
}

type MemoryWriteResult = number;

class Memory implements MemoryType {

    memoryBlocks = {
        'BIOS': new Uint8Array(segments.BIOS.end - segments.BIOS.start + 1),
        'WRAM_O': new Uint8Array(segments.WRAM_O.end - segments.WRAM_O.start + 1),
        'WRAM_I': new Uint8Array(segments.WRAM_I.end - segments.WRAM_I.start + 1),
        'IO': new Uint8Array(segments.IO.end - segments.IO.start + 1),
        'PALETTE': new Uint8Array(segments.PALETTE.end - segments.PALETTE.start + 1),
        'VRAM': new Uint8Array(segments.VRAM.end - segments.VRAM.start + 1),
        'OAM': new Uint8Array(segments.OAM.end - segments.OAM.start + 1),
        'ROM_WS0': new Uint8Array(segments.ROM_WS0.end - segments.ROM_WS0.start + 1),
        'ROM_WS1': new Uint8Array(segments.ROM_WS1.end - segments.ROM_WS1.start + 1),
        'ROM_WS2': new Uint8Array(segments.ROM_WS2.end - segments.ROM_WS2.start + 1),
        'SRAM': new Uint8Array(segments.SRAM.end - segments.SRAM.start + 1),
    };
    cpu: any;

    constructor() {
        this.reset();
        this.cpu = null;
    }

    reset = (): void => {
        for (const block in this.memoryBlocks) {
            this.memoryBlocks[block as MemorySegment].fill(0);
        }
    }

    /**
     * Use bits 28-24 to determine the segment for a given address. This fails to consider accesses that are out
     * of the upper bounds of the segment.
     */
    getSegment = (address: number): MemorySegment => {
        const segmentIndex = Math.max((address >> 24) - 1, 0);
        return segmentsByIndex[segmentIndex];
    }

    getBytes = (address: number, bytes: number): Uint8Array => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        address = address - segments[segment].start;

        const result = new Uint8Array(bytes);
        for (let i = 0; i < bytes; i++) {
            result[i] = this.memoryBlocks[segment][address + i];
        }
        return result;
    }

    getInt32 = (address: number): MemoryReadResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        address = address - segments[segment].start;

        let result = 0;
        result |= this.memoryBlocks[segment][address + 0] << (0 * 8);
        result |= this.memoryBlocks[segment][address + 1] << (1 * 8);
        result |= this.memoryBlocks[segment][address + 2] << (2 * 8);
        result |= this.memoryBlocks[segment][address + 3] << (3 * 8);

        return { value: result, cycles: waitStateCycles[segment].nSeq32 };
    }

    getInt16 = (address: number): MemoryReadResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        address = address - segments[segment].start;
        let result = 0;

        result |= this.memoryBlocks[segment][address + 0] << (0 * 8);
        result |= this.memoryBlocks[segment][address + 1] << (1 * 8);

        return { value: result, cycles: waitStateCycles[segment].nSeq16 };
    }

    getInt8 = (address: number): MemoryReadResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        address = address - segments[segment].start;
        let result = this.memoryBlocks[segment][address];
        return { value: result, cycles: waitStateCycles[segment].nSeq16 };
    }

    /**
     * Sets a sequential number of bytes in memory at the given address. The
     * number of CPU cycles used for the memory access is returned.
     */
    setBytes = (address: number, bytes: Uint8Array, checkForInterruptAck: boolean = true): MemoryWriteResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);

        // Return early since interrupt acknowledgements don't actual write these
        // bytes to memory.
        if (checkForInterruptAck && handleInterruptAcknowledge(this.cpu, address, bytes)) {
            return waitStateCycles[segment].nSeq32;
        }

        const segmentAddress = address - segments[segment].start;
        for (let j = 0; j < bytes.length; j++) {
            this.memoryBlocks[segment][segmentAddress + j] = bytes[j];
        }

        return waitStateCycles[segment].nSeq32;
    }

    setBytesForInterrupt = (address: number, bytes: Uint8Array): void => {
        this.setBytes(address, bytes, false);
    }

    /**
     * If the given address is "mirrored" in memory, the smaller
     * of the equivalent addresses is returned.
     */
    resolveMirroredAddress = (address: number): number => {
        if ((address & 0xFFFFFF00) === 0x03FFFF00) {
            return 0x03007F00 | (address & 0xFF);
        }
        return address;
    }

    loadROM = (rom: Uint8Array): void => {
        this.memoryBlocks.ROM_WS0.fill(0);
        this.memoryBlocks.ROM_WS1.fill(0);
        this.memoryBlocks.ROM_WS2.fill(0);
        for (let i = 0; i < rom.length; i++) {
            this.memoryBlocks.ROM_WS0[i] = rom[i];
            this.memoryBlocks.ROM_WS1[i] = rom[i];
            this.memoryBlocks.ROM_WS2[i] = rom[i];
        }
    }

    loadBIOS = (bios: Uint8Array): void => {
        for (let i = 0; i < bios.length; i++) {
            this.memoryBlocks.BIOS[i] = bios[i];
        }
    }

}

export { Memory, segments as MemorySegments, MemorySegment }
