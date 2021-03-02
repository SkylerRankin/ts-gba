type MemorySegment = 'BIOS' | 'WRAM_O' | 'WRAM_I' | 'IO' | 'BG_OBJ' | 'VRAM' | 'OAM' | 'ROM' | 'UNUSED';
const segments: {[key in MemorySegment]: {[key in 'start' | 'end']: number}} = {
    'BIOS':     { start: 0x00000000, end: 0x00003FFFF },
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
    loadROM: (rom: number[]) => void
};

class Memory implements MemoryType {

    memoryBlocks = {
        'BIOS': new Uint8Array(segments.BIOS.end - segments.BIOS.start),
        'WRAM_O': new Uint8Array(0),
        'WRAM_I': new Uint8Array(0),
        'IO': new Uint8Array(0),
        'BG_OBJ': new Uint8Array(0),
        'VRAM': new Uint8Array(0),
        'OAM': new Uint8Array(0),
        'ROM': new Uint8Array(segments.ROM.end - segments.ROM.start),
        'UNUSED': new Uint8Array(0)
    };

    reset = (): void => {

    }

    getSegment = (address: number): MemorySegment => {
        let segment: MemorySegment = 'UNUSED';
        Object.keys(segments).forEach((s: string) => {
            if (segments[s as MemorySegment].start <= address &&
                segments[s as MemorySegment].end > address) {
                segment = s as MemorySegment;
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

    loadROM = (rom: number[]): void => {
        this.memoryBlocks.ROM.fill(0);
        for (let i = 0; i < rom.length; i++) {
            this.memoryBlocks.ROM[i] = rom[i];
        }
    }

}

export { Memory }
