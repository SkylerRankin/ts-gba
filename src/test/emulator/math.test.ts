import {
    encodeWithRotation, rotateRight, rotateLeft, signExtend,
    byteArrayToInt32, int32ToByteArray, toBigEndianInt32, toBigEndianInt16 } from '../../emulator/math';

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

test('signExtend', () => {
    expect(signExtend(1, 1)).toBe(-1);
    expect(signExtend(1, 2)).toBe(1);
    expect(signExtend(1, 20)).toBe(1);
    expect(signExtend(4, 1)).toBe(0);
    expect(signExtend(0xCCCCDE7, 32)).toBe(0xCCCCDE7);
    expect(signExtend(-10, 5)).toBe(-10);
});

test('byteArrayToInt32 and int32ToByteArray', () => {
    const a = Uint8Array.from([0xFF, 0, 0xAA, 0]);
    const b = 0xFF00AA00;
    expect(byteArrayToInt32(a, true)).toBe(0xFF00AA00);
    expect(byteArrayToInt32(a, false)).toBe(0xAA00FF);
    expect(int32ToByteArray(b, true)).toStrictEqual(a);
    expect(int32ToByteArray(b, false)).toStrictEqual(Uint8Array.from([0, 0xAA, 0, 0xFF]));
});

test('toBigEndianInt32', () => {
    expect(toBigEndianInt32(0x12345678)).toBe(0x78563412);
    expect(toBigEndianInt32(0x910002E1)).toBe(0xE1020091);
});

test('toBigEndianInt16', () => {
    expect(toBigEndianInt16(0x1234)).toBe(0x3412);
    expect(toBigEndianInt16(0x9100)).toBe(0x0091);
});
