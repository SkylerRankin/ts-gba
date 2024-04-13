const IO_REGISTERS = {
    DISPCNT:    [ 0x04000000, 2 ],
    DISPSTAT:   [ 0x04000004, 2 ],
    VCOUNT:     [ 0x04000006, 2 ],
    BG0CNT:     [ 0x04000008, 2 ],
    BG1CNT:     [ 0x0400000A, 2 ],
    BG2CNT:     [ 0x0400000C, 2 ],
    BG3CNT:     [ 0x0400000E, 2 ],
    BG0HOFS:    [ 0x04000010, 2 ],
    BG0VOFS:    [ 0x04000012, 2 ],
    BG1HOFS:    [ 0x04000014, 2 ],
    BG1VOFS:    [ 0x04000016, 2 ],
    BG2HOFS:    [ 0x04000018, 2 ],
    BG2VOFS:    [ 0x0400001A, 2 ],
    BG3HOFS:    [ 0x0400001C, 2 ],
    BG3VOFS:    [ 0x0400001E, 2 ],
    BG2PA:      [ 0x04000020, 2 ],
    BG2PB:      [ 0x04000022, 2 ],
    BG2PC:      [ 0x04000024, 2 ],
    BG2PD:      [ 0x04000026, 2 ],
    BG2X:       [ 0x04000028, 4 ],
    BG2Y:       [ 0x0400002C, 4 ],
    BG3PA:      [ 0x04000030, 2 ],
    BG3PB:      [ 0x04000032, 2 ],
    BG3PC:      [ 0x04000034, 2 ],
    BG3PD:      [ 0x04000036, 2 ],
    BG3X:       [ 0x04000038, 4 ],
    BG3Y:       [ 0x0400003C, 4 ],
    WIN0H:      [ 0x04000040, 2 ],
    WIN1H:      [ 0x04000042, 2 ],
    WIN0V:      [ 0x04000044, 2 ],
    WIN1V:      [ 0x04000046, 2 ],
    WININ:      [ 0x04000048, 2 ],
    WINOUT:     [ 0x0400004A, 2 ],
    DMA0SAD:    [ 0x040000B0, 4 ],
    DMA0DAD:    [ 0x040000B4, 4 ],
    DMA0CNT_L:  [ 0x040000B8, 2 ],
    DMA0CNT_H:  [ 0x040000BA, 2 ],
    DMA1SAD:    [ 0x040000BC, 4 ],
    DMA1DAD:    [ 0x040000C0, 4 ],
    DMA1CNT_L:  [ 0x040000C4, 2 ],
    DMA1CNT_H:  [ 0x040000C6, 2 ],
    DMA2SAD:    [ 0x040000C8, 4 ],
    DMA2DAD:    [ 0x040000CC, 4 ],
    DMA2CNT_L:  [ 0x040000D0, 2 ],
    DMA2CNT_H:  [ 0x040000D2, 2 ],
    DMA3SAD:    [ 0x040000D4, 4 ],
    DMA3DAD:    [ 0x040000D8, 4 ],
    DMA3CNT_L:  [ 0x040000DC, 2 ],
    DMA3CNT_H:  [ 0x040000DE, 2 ],
    KEYINPUT:   [ 0x04000130, 2 ],
    KEYCNT:     [ 0x04000132, 2 ],
    IE:         [ 0x04000200, 2 ],
    IF:         [ 0x04000202, 2 ],
    WAITCNT:    [ 0x04000204, 2 ],
    IME:        [ 0x04000208, 2 ],
};

const IO_REGISTER_OFFSETS = new Uint8Array(1024).fill(0);
const IO_REGISTER_SIZES = new Uint8Array(1024).fill(0);
const IOCache = new Uint32Array(1024).fill(0);

const updateIOCache8 = (address: number, value: number) : boolean => {
    if (address >> 16 === 0x0400) {
        const index = address & 0x3FF;
        const registerSize = IO_REGISTER_SIZES[index];
        if (registerSize === 2) {
            IOCache[index] = (value & 0xFF) | (IOCache[index] & 0xFF00);
        } else if (registerSize === 4) {
            IOCache[index] = (value & 0xFF) | (IOCache[index] & 0xFFFFFF00);
        } else if (registerSize === 0) {
            // This address does not align with the start of any IO address. Use the offsets array to check if it
            // overlaps the middle/end of some register.
            const offset = IO_REGISTER_OFFSETS[index];
            if (offset === 0) {
                // Does not overlap any register, this write is effectively ignored.
            } else {
                // Address does overlap a register and is `offset` bytes ahead. Update this register with the written byte.
                const mask = 0xFF << (offset * 8);
                IOCache[index - offset] = (IOCache[index - offset] & (~mask)) | (value << (offset * 8));
            }
        }
        return false;
    }
    return false;
}

const updateIOCache16 = (address: number, value: number) : boolean => {
    if (address >> 16 === 0x0400) {
        const index = address & 0x3FF;
        const size = IO_REGISTER_SIZES[index];
        
        if (size === 2) {
            IOCache[index] = value;
        } else if (size === 4) {
            IOCache[index] = (IOCache[index] & 0xFFFF0000) | value;
        } else if (size === 0) {
            // No specific IO register starts at the given address, so treat this write as
            // two 8 bit writes, and insert those bytes in the registers they overlap.
            updateIOCache8(address, value & 0xFF);
            updateIOCache8(address + 1, (value >> 8) & 0xFF);
        }
        // TODO: ensure that all IO register reads come from IOCache, and update this to true.
        return false;
    }
    return false;
}

const updateIOCache32 = (address: number, value: number) : boolean => {
    if (address >> 16 === 0x0400) {
        const index = address & 0x3FF;
        const size = IO_REGISTER_SIZES[index];

        if (size === 4) {
            IOCache[index] = value;
        } else if (size === 2) {
            // Writing to a 16 bit register, use the lower two bytes. Then handle the
            // upper two bytes as a separate 16 bit write.
            IOCache[index] = value & 0xFFFF;
            updateIOCache16(address + 2, value >>> 16);
        } else if (size === 0) {
            // No specific IO register starts at this address. Attempt to write each byte
            // into whatever register they may overlap with.
            updateIOCache8(address, value & 0xFF);
            updateIOCache8(address + 1, (value >> 8) & 0xFF);
            updateIOCache8(address + 2, (value >> 16) & 0xFF);
            updateIOCache8(address + 3, (value >> 24) & 0xFF);
        }
        return false;
    }
    return false;
}

const getCachedIORegister = (address: number) : number => {
    return IOCache[address & 0x3FF];
}

const resetIOCache = () => {
    IOCache.fill(0);
}

const buildIOCacheRegisterArrays = () => {
    Object.values(IO_REGISTERS).forEach(([address, size]) => {
        const index = address & 0x3FF;
        IO_REGISTER_SIZES[index] = size;
        for (let i = 1; i < size; i++) {
            IO_REGISTER_OFFSETS[index + i] = i;
        }
    });
}

buildIOCacheRegisterArrays();

export { getCachedIORegister, updateIOCache8, updateIOCache16, updateIOCache32, resetIOCache, buildIOCacheRegisterArrays };
