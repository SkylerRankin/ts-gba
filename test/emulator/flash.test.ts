import { FlashMemory } from "../../src/emulator/flash";

test("Chip identification", () => {
    const flash = new FlashMemory();
    flash.reset();

    expect(flash.read8(0x0E000000)).toBe(0xFF);
    expect(flash.read8(0x0E000001)).toBe(0xFF);

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0x90);

    expect(flash.read8(0x0E000000)).toBe(0xC2);
    expect(flash.read8(0x0E000001)).toBe(0x09);

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0xF0);

    expect(flash.read8(0x0E000000)).toBe(0xFF);
    expect(flash.read8(0x0E000001)).toBe(0xFF);
});

test("Write and read byte", () => {
    const flash = new FlashMemory();
    flash.reset();

    const address = 0x0E000102;
    const value = 0x76;

    expect(flash.read8(address)).toBe(0xFF);

    // Ignore write without command
    expect(() => {
        flash.write8(address, value);
    }).toThrowError();
    expect(flash.read8(address)).toBe(0xFF);

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0xA0);
    flash.write8(address, value);

    expect(flash.read8(address)).toBe(value);
});

test("Erase sector", () => {
    const flash = new FlashMemory();
    flash.reset();

    const baseAddress = 0x0E003FFD;
    for (let i = 0; i < 10; i++) {
        flash.write8(0x0E005555, 0xAA);
        flash.write8(0x0E002AAA, 0x55);
        flash.write8(0x0E005555, 0xA0);
        flash.write8(baseAddress + i, i);
    }

    for (let i = 0; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(i);
    }

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0x80);
    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E004000, 0x30);

    for (let i = 0; i < 3; i++) {
        expect(flash.read8(baseAddress + i)).toBe(i);
    }

    for (let i = 3; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(0xFF);
    }
});

test("Erase chip", () => {
    const flash = new FlashMemory();
    flash.reset();

    const baseAddress = 0x0E003FFD;
    for (let i = 0; i < 10; i++) {
        flash.write8(0x0E005555, 0xAA);
        flash.write8(0x0E002AAA, 0x55);
        flash.write8(0x0E005555, 0xA0);
        flash.write8(baseAddress + i, i);
    }

    for (let i = 0; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(i);
    }

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0x80);
    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0x10);

    for (let i = 0; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(0xFF);
    }
});

test("Bank switch", () => {
    const flash = new FlashMemory();
    flash.reset();

    const baseAddress = 0x0E000800;
    for (let i = 0; i < 10; i++) {
        flash.write8(0x0E005555, 0xAA);
        flash.write8(0x0E002AAA, 0x55);
        flash.write8(0x0E005555, 0xA0);
        flash.write8(baseAddress + i, i);
    }

    for (let i = 0; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(i);
    }

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0xB0);
    flash.write8(0x0E000000, 0x1);

    for (let i = 0; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(0xFF);
    }

    flash.write8(0x0E005555, 0xAA);
    flash.write8(0x0E002AAA, 0x55);
    flash.write8(0x0E005555, 0xB0);
    flash.write8(0x0E000000, 0x0);

    for (let i = 0; i < 10; i++) {
        expect(flash.read8(baseAddress + i)).toBe(i);
    }
});
