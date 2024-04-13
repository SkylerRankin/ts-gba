import { buildIOCacheRegisterArrays, getCachedIORegister, resetIOCache, updateIOCache16, updateIOCache32, updateIOCache8 } from "../../src/emulator/ioCache";

const DISPSTAT = 0x04000004;
const VCOUNT = 0x04000006;
const BG0CNT = 0x04000008;
const DMA0SAD = 0x040000B0;
const DMA0DAD = 0x040000B4;

buildIOCacheRegisterArrays();

describe("1 byte writes", () => {
    test("Write to 16 bit register", () => {
        resetIOCache();

        // Set first byte
        updateIOCache8(DISPSTAT, 0xBD);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xBD);

        // Set second byte
        updateIOCache8(DISPSTAT + 1, 0xBC);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xBCBD);

        // Attempt to set byte after register
        updateIOCache8(DISPSTAT + 2, 0xBE);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xBCBD);
    });

    test("Write to 32 bit register", () => {
        resetIOCache();

        // Set first byte
        updateIOCache8(DMA0SAD, 0xAA);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xAA);

        // Set second byte
        updateIOCache8(DMA0SAD + 1, 0xAB);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xABAA);

        // Set third byte
        updateIOCache8(DMA0SAD + 2, 0xAC);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xACABAA);

        // Set fourth byte
        updateIOCache8(DMA0SAD + 3, 0xAD);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xADACABAA);

        // Attempt to set byte after register
        updateIOCache8(DMA0SAD + 4, 0xAE);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xADACABAA);
    });
});

describe("2 byte writes", () => {
    test("Write to 16 bit register", () => {
        resetIOCache();

        // Set bytes before the register
        updateIOCache16(DISPSTAT - 2, 0xABCD);
        expect(getCachedIORegister(DISPSTAT)).toBe(0x0);

        // Overlap with first byte
        updateIOCache16(DISPSTAT - 1, 0xABCD);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xAB);

        // Align with both bytes
        updateIOCache16(DISPSTAT, 0x1234);
        expect(getCachedIORegister(DISPSTAT)).toBe(0x1234);

        // Overlap with last byte
        updateIOCache16(DISPSTAT + 1, 0xABCD);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xCD34);

        // Set bytes after the register
        updateIOCache16(DISPSTAT + 2, 0x0);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xCD34);
    });

    test("Write to 32 bit register", () => {
        resetIOCache();

        // Set bytes before the register
        updateIOCache16(DMA0SAD - 2, 0xABCD);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x0);

        // Overlap first byte
        updateIOCache16(DMA0SAD - 1, 0xABCD);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xAB);

        // Overlap first two bytes
        updateIOCache16(DMA0SAD, 0xABCD);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xABCD);
    
        // Overlap second and third bytes
        updateIOCache16(DMA0SAD + 1, 0xAABB);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xAABBCD);

        // Overlap third and fourth bytes
        updateIOCache16(DMA0SAD + 2, 0x2324);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x2324BBCD);
    
        // Overlap fourth byte
        updateIOCache16(DMA0SAD + 3, 0xFFFF);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xFF24BBCD);

        // Overlap third and fourth bytes
        updateIOCache16(DMA0SAD + 4, 0x1111);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xFF24BBCD);
    });
});

describe("4 byte writes", () => {
    test("Write to 16 bit register", () => {
        resetIOCache();

        // Set bytes before the register
        updateIOCache32(DISPSTAT - 4, 0xFFFFFFFF);
        expect(getCachedIORegister(DISPSTAT)).toBe(0x0);

        // Overlap first byte
        updateIOCache32(DISPSTAT - 3, 0xFFFFFFFF);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xFF);

        // Overlap both bytes
        updateIOCache32(DISPSTAT - 2, 0xEEDDFFFF);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xEEDD);

        // Overlap both bytes, last byte goes to next register
        updateIOCache32(DISPSTAT - 1, 0xAABBCCFF);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xBBCC);
        expect(getCachedIORegister(VCOUNT)).toBe(0xAA);

        // Overlap both bytes, last two bytes go to next register
        updateIOCache32(DISPSTAT, 0xEECCFFDD);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xFFDD);
        expect(getCachedIORegister(VCOUNT)).toBe(0xEECC);

        // Overlap last byte, next three bytes go to next registers
        updateIOCache32(DISPSTAT + 1, 0xAABBCCDD);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xDDDD);
        expect(getCachedIORegister(VCOUNT)).toBe(0xBBCC);
        expect(getCachedIORegister(BG0CNT)).toBe(0xAA);

        // Set bytes after the register
        updateIOCache32(DISPSTAT + 2, 0xFFFFFFFF);
        expect(getCachedIORegister(DISPSTAT)).toBe(0xDDDD);
    });

    test("Write to 32 bit register", () => {
        resetIOCache();

        // Set bytes before the register
        updateIOCache32(DMA0SAD - 4, 0xFFFFFFFF);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x0);

        // Overlap first byte
        updateIOCache32(DMA0SAD - 3, 0xAABBCCDD);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xAA);

        // Overlap two bytes
        updateIOCache32(DMA0SAD - 2, 0xBBCCDDEE);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xBBCC);

        // Overlap three bytes
        updateIOCache32(DMA0SAD - 1, 0xCCDDEEFF);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xCCDDEE);

        // Overlap all bytes
        updateIOCache32(DMA0SAD, 0x12341234);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x12341234);

        // Overlap last three bytes
        updateIOCache32(DMA0SAD + 1, 0xCCDDEEFF);
        expect(getCachedIORegister(DMA0SAD)).toBe(0xDDEEFF34);
        expect(getCachedIORegister(DMA0DAD)).toBe(0xCC);

        // Overlap last two bytes
        updateIOCache32(DMA0SAD + 2, 0x22334455);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x4455FF34);
        expect(getCachedIORegister(DMA0DAD)).toBe(0x2233);

        // Overlap last byte
        updateIOCache32(DMA0SAD + 3, 0x22334455);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x5555FF34);
        expect(getCachedIORegister(DMA0DAD)).toBe(0x223344);

        // Set bytes after register
        updateIOCache32(DMA0SAD + 4, 0x11223344);
        expect(getCachedIORegister(DMA0SAD)).toBe(0x5555FF34);
        expect(getCachedIORegister(DMA0DAD)).toBe(0x11223344);

    });
});

