type MemorySegment = 'BIOS' | 'WRAM_O' | 'WRAM_I' | 'IO' | 'BG_OBJ' | 'VRAM' | 'OAM' | 'ROM' | 'UNUSED';
const segments: {[key in MemorySegment]: {[key in 'start' | 'end']: number}} = {
    'BIOS':     { start: 0x00000000, end: 0x00003FFF },
    'WRAM_O':   { start: 0x02000000, end: 0x0203FFFF },
    'WRAM_I':   { start: 0x03000000, end: 0x03007FFF },
    'IO':       { start: 0x04000000, end: 0x040003FE },
    'BG_OBJ':   { start: 0x05000000, end: 0x050003FF },
    'VRAM':     { start: 0x06000000, end: 0x06017FFF },
    'OAM':      { start: 0x07000000, end: 0x070003FF },
    'ROM':      { start: 0x08000000, end: 0x09FFFFFF },
    'UNUSED':   { start: -1, end: -1 }
};

interface MemoryType {
    memoryBlocks: {[key in MemorySegment]: Uint8Array}
    reset: () => void
    getSegment: (address: number) => MemorySegment
    getBytes: (address: number, bytes: number) => Uint8Array
    setBytes: (address: number, data: Uint8Array) => void
    loadROM: (rom: Uint8Array) => void
};

class Memory implements MemoryType {

    memoryBlocks = {
        'BIOS': new Uint8Array(segments.BIOS.end - segments.BIOS.start + 1),
        'WRAM_O': new Uint8Array(segments.WRAM_O.end - segments.WRAM_O.start + 1),
        'WRAM_I': new Uint8Array(segments.WRAM_I.end - segments.WRAM_I.start + 1),
        'IO': new Uint8Array(segments.IO.end - segments.IO.start + 1),
        'BG_OBJ': new Uint8Array(segments.BG_OBJ.end - segments.BG_OBJ.start + 1),
        'VRAM': new Uint8Array(segments.VRAM.end - segments.VRAM.start + 1),
        'OAM': new Uint8Array(segments.OAM.end - segments.OAM.start + 1),
        'ROM': new Uint8Array(segments.ROM.end - segments.ROM.start + 1),
        'UNUSED': new Uint8Array(segments.UNUSED.end - segments.UNUSED.start + 1),
    };

    constructor() {
        this.reset();
    }

    reset = (): void => {
        this.memoryBlocks.BIOS.fill(0);
    }

    getSegment = (address: number): MemorySegment => {
        let segment: MemorySegment = 'UNUSED';
        (Object.keys(segments) as MemorySegment[]).forEach((s: MemorySegment) => {
            if (segments[s].start <= address &&
                segments[s].end > address) {
                segment = s;
            }
        });
        return segment;
    }

    getBytes = (address: number, bytes: number): Uint8Array => {
        const segment = this.getSegment(address);
        address = address - segments[segment].start;
        const result = new Uint8Array(bytes);
        for (let i = 0; i < bytes; i++) {
            result[i] = this.memoryBlocks[segment][address + i];
        }
        return result;
    }

    setBytes = (address: number, bytes: Uint8Array): void => {
        const segment = this.getSegment(address);
        address = address - segments[segment].start;
        for (let i = 0; i < bytes.length; i++) {
            this.memoryBlocks[segment][address + i] = bytes[i];
        }
    }

    loadROM = (rom: Uint8Array): void => {
        this.memoryBlocks.ROM.fill(0);
        for (let i = 0; i < rom.length; i++) {
            this.memoryBlocks.ROM[i] = rom[i];
        }
    }

}

export { Memory, segments as MemorySegments }
