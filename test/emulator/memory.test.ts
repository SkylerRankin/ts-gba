import { Memory, MemorySegment, MemorySegments } from "../../src/emulator/memory";


test('Set word in WRAM', () => {
    const memory = new Memory();
    memory.reset();

    const address = 0x03007ff2;
    const data = 0x1234;
    memory.setInt32(address, data);

    const actual = memory.getInt32(address).value;
    expect(actual).toStrictEqual(data);
});

test('Determine address segment', () => {
    const testCases: {address: number, segment: MemorySegment}[] = [
        { address: 0x00000000, segment: 'BIOS' },
        { address: 0x00001FF4, segment: 'BIOS' },
        { address: 0x00003FFF, segment: 'BIOS' },
        { address: 0x02000000, segment: 'WRAM_O' },
        { address: 0x0200FF40, segment: 'WRAM_O' },
        { address: 0x0203FFFF, segment: 'WRAM_O' },
        { address: 0x03000000, segment: 'WRAM_I' },
        { address: 0x03005000, segment: 'WRAM_I' },
        { address: 0x03007FFF, segment: 'WRAM_I' },
        { address: 0x04000000, segment: 'IO' },
        { address: 0x04000244, segment: 'IO' },
        { address: 0x040003FE, segment: 'IO' },
        { address: 0x05000000, segment: 'PALETTE' },
        { address: 0x0500000D, segment: 'PALETTE' },
        { address: 0x050003FF, segment: 'PALETTE' },
        { address: 0x06000000, segment: 'VRAM' },
        { address: 0x0600FFEE, segment: 'VRAM' },
        { address: 0x06017FFF, segment: 'VRAM' },
        { address: 0x07000000, segment: 'OAM' },
        { address: 0x0700020D, segment: 'OAM' },
        { address: 0x070003FF, segment: 'OAM' },
        { address: 0x08000000, segment: 'ROM_WS0' },
        { address: 0x08FFF000, segment: 'ROM_WS0' },
        { address: 0x09FFFFFF, segment: 'ROM_WS0' },
        { address: 0x0A000000, segment: 'ROM_WS1' },
        { address: 0x0B00EEE0, segment: 'ROM_WS1' },
        { address: 0x0BFFFFFF, segment: 'ROM_WS1' },
        { address: 0x0C000000, segment: 'ROM_WS2' },
        { address: 0x0CFEEE02, segment: 'ROM_WS2' },
        { address: 0x0DFFFFFF, segment: 'ROM_WS2' },
        { address: 0x0E000000, segment: 'SRAM' },
        { address: 0x0E00EFFF, segment: 'SRAM' },
        { address: 0x0E00FFFF, segment: 'SRAM' },
    ];
    const memory = new Memory();
    memory.reset();

    testCases.forEach(({ address, segment }) => {
        const actualSegment = memory.getSegment(address);
        expect(actualSegment, `Address 0x${address.toString(16)} should map to ${segment}, not ${actualSegment}.`).toBe(segment);
    });
});
