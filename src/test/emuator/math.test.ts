import { encodeWithRotation, rotateRight, rotateLeft } from '../../emulator/math';

test('rotateRight', () => {
    expect(rotateRight(15, 3, 8)).toBe(225);
    expect(rotateRight(9, 0, 8)).toBe(9);
    expect(rotateRight(9, 1, 8)).toBe(132);
    expect(rotateRight(73, 5, 7)).toBe(38);
});

test('rotateLeft', () => {
    expect(rotateLeft(15, 3, 8)).toBe(120);
    expect(rotateLeft(9, 0, 8)).toBe(9);
    expect(rotateLeft(9, 1, 8)).toBe(18);
    expect(rotateLeft(73, 5, 7)).toBe(50);
});

test('encodeWithRotation', () => {
    expect(() => encodeWithRotation(225, 8, 4, 4)).toThrow('Rotation must be even.');
    expect(() => encodeWithRotation(258, 32, 4, 8)).toThrow('Rotation must be even.');
    expect(() => encodeWithRotation('0xFF0000FF', 32, 4, 8)).toThrow('Required immediate is too wide.');
    expect(encodeWithRotation('0xC0000034', 32, 4, 8)).toStrictEqual([1, 211]);
    expect(encodeWithRotation(261120, 32, 4, 8)).toStrictEqual([11, 255]);
    expect(encodeWithRotation('0x0A000000', 32, 4, 8)).toStrictEqual([4, 10]);
    expect(encodeWithRotation('0x0A10000', 32, 4, 8)).toStrictEqual([8, 161]);
    expect(encodeWithRotation('0xAF0', 32, 4, 8)).toStrictEqual([14, 175]);
    expect(encodeWithRotation('0xC0000001', 32, 4, 8)).toStrictEqual([1, 7]);
});