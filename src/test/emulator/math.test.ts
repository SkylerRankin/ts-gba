import {
    encodeWithRotation, rotateRight, rotateLeft, signExtend,
    byteArrayToInt32, int32ToByteArray, toBigEndianInt32, toBigEndianInt16, logicalShiftLeft, borrowFrom, twosComplementNegation, int16ToByteArray, int8ToByteArray } from '../../emulator/math';

test('logicalShiftLeft', () => {
    expect(logicalShiftLeft(2, 0)).toStrictEqual([2, 0]);
    expect(logicalShiftLeft(2, 2)).toStrictEqual([8, 0]);
    expect(logicalShiftLeft(6, 30)).toStrictEqual([0x80000000, 1]);
});

test('rotateRight', () => {
    expect(rotateRight(15, 3, 8)).toBe(225);
    expect(rotateRight(9, 0, 8)).toBe(9);
    expect(rotateRight(9, 1, 8)).toBe(132);
    expect(rotateRight(73, 5, 7)).toBe(38);
    expect(rotateRight(4, 4, 32)).toBe(0x40000000);
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

test('byteArrayToInt32 and int16ToByteArray', () => {
    const a = Uint8Array.from([0xFF, 0xAA]);
    const b = 0xFFAA;
    expect(byteArrayToInt32(a, true)).toBe(0xFFAA);
    expect(byteArrayToInt32(a, false)).toBe(0xAAFF);
    expect(int16ToByteArray(b, true)).toStrictEqual(a);
    expect(int16ToByteArray(b, false)).toStrictEqual(Uint8Array.from([0xAA, 0xFF]));
});

test('byteArrayToInt32 and int8ToByteArray', () => {
    const a = Uint8Array.from([0xFB]);
    const b = 0xFB;
    expect(byteArrayToInt32(a, true)).toBe(0xFB);
    expect(byteArrayToInt32(a, false)).toBe(0xFB);
    expect(int8ToByteArray(b, true)).toStrictEqual(a);
    expect(int8ToByteArray(b, false)).toStrictEqual(a);
});

test('toBigEndianInt32', () => {
    expect(toBigEndianInt32(0x12345678)).toBe(0x78563412);
    expect(toBigEndianInt32(0x910002E1)).toBe(0xE1020091);
});

test('toBigEndianInt16', () => {
    expect(toBigEndianInt16(0x1234)).toBe(0x3412);
    expect(toBigEndianInt16(0x9100)).toBe(0x0091);
});

test('borrowFrom', () => {
    // Both positive
    expect(borrowFrom(0xC, 0xA)).toBe(0);
    expect(borrowFrom(0xA, 0xC)).toBe(1);
    // Both negative
    expect(borrowFrom(0xFFFFFFFB, 0xFFFFFFFC)).toBe(1);
    expect(borrowFrom(0xFFFFFFFC, 0xFFFFFFFB)).toBe(0);
    // One smaller negative
    expect(borrowFrom(0xFFFFFFF6, 0xB)).toBe(0);
    expect(borrowFrom(0xB, 0xFFFFFFF6)).toBe(1);
    // One larger negative
    expect(borrowFrom(0xFFFFFFF7, 0xA)).toBe(0);
    expect(borrowFrom(0xA, 0xFFFFFFF7)).toBe(1);
    // Zero
    expect(borrowFrom(0, 0)).toBe(0);
});

test('twosComplementNegation', () => {
    expect(twosComplementNegation(0)).toBe(0);
    expect(twosComplementNegation(1)).toBe(0xFFFFFFFF);
    expect(twosComplementNegation(0xFFFFFFFF)).toBe(1);
    expect(twosComplementNegation(0xA03)).toBe(0xFFFFF5FD);
    expect(twosComplementNegation(0xFFFFF5FD)).toBe(0xA03);
});
