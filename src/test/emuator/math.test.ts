import { encodeWithRotation, rotateRight, rotateLeft } from '../../emulator/math';

test('rotateRight', () => {
    expect(rotateRight(15, 3, 8)).toBe(225);
    expect(rotateRight(9, 0, 8)).toBe(9);
    expect(rotateRight(9, 1, 8)).toBe(132);
    expect(rotateRight(73, 5, 7)).toBe(38);
});

test('rotateLeft', () => {
    expect(rotateLeft(15, 3, 8)).toBe(120); // 01111000
    expect(rotateLeft(9, 0, 8)).toBe(9);
    expect(rotateLeft(9, 1, 8)).toBe(18);
    expect(rotateLeft(73, 5, 7)).toBe(50); // 0110010
});

test('encodeWithRotation', () => {
    // expect(encodeWithRotation(225, 8, 4)).toStrictEqual([3, 15]);
    // expect(encodeWithRotation(9, 8, 4)).toStrictEqual([0, 9]);
    // expect(encodeWithRotation(132, 8, 4)).toStrictEqual([1, 9]);
    // expect(encodeWithRotation(161, 8, 4)).toStrictEqual([3, 13]);
    expect(encodeWithRotation(261120, 32, 8)).toStrictEqual([11, 15]);
});