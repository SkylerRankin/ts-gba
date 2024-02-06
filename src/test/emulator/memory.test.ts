import { Memory } from "../../emulator/memory";


test('Set word in WRAM', () => {
    const memory = new Memory();
    memory.reset();

    const address = 0x03007ff2;
    const data = new Uint8Array([0, 1, 2, 3]);
    memory.setBytes(address, data);

    const actual = memory.getBytes(address, 4);
    expect(actual).toStrictEqual(data);
});
