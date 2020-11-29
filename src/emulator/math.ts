import Long from 'long';

const rotateRight = (n: number, r: number, bits: number) : number => {
    return ((n >> r) | (n << (bits - r))) & (Math.pow(2, bits) - 1);
}

const rotateLeft = (n: number, r: number, bits: number) : number => {
    return ((n << r) | (n >> (bits - r))) & (Math.pow(2, bits) - 1);
}

const logicalShiftRight = (n: number, s: number) : number => {
    if (s >= 32) return 0;
    return n >>> s;
}

const arithmeticShiftRight = (n: number, s: number) : number => {
    if (s >= 32) return n < 0 ? -1 : 0;
    return n >> s;
}

const logicalShiftLeft = (n: number, s: number) : number => {
    return n << s;
}

// Converts an number n into values r and i such that n = i >> 2r. This operation (>>) is a right rotation.
// The bitwise sizes of n, r, and i are restricted by bits, rotBits, and immBits respectively.
// Returns an array [rotation, immediate].
function encodeWithRotation(n: any | number | string | Long, bits:number, rotBits: number, immBits: number) : number[] {
    n = (typeof(n) === 'string') ? Long.fromString(n, true, 16) : 
        (typeof(n) === 'number') ? Long.fromNumber(n) :
        n;

    if (n.greaterThanOrEqual(0) && n.lessThanOrEqual(Math.pow(immBits, 2) - 1)) return [0, n.toInt()];
    let r = 0;
    let max: Long = new Long(Math.pow(2, immBits) - 1);

    while ((n.lessThan(Long.ZERO) || n.greaterThan(max)) && r < bits) {
        n = n.shiftLeft(1).or(n.shiftRightUnsigned(bits - 1)).and(Math.pow(2, bits) - 1);
        r++;
    }

    // If the immediate was shifted into the correct range, but used an odd number of rotated bits,
    // then shift one more to remain in the range, but use an even number of rotated bits. Only works
    // if the most significant bit is a zero.
    if (n.greaterThanOrEqual(Long.ZERO) && n.lessThanOrEqual(max) && r % 2 !== 0) {
        if (n.lessThanOrEqual(max.divide(2))) {
            r++;
            n = n.shiftLeft(1);
        }
    }

    if (r % 2 !== 0) {
        throw new Error('Rotation must be even.');
    } else if (n.greaterThanOrEqual(Long.fromInt(Math.pow(2, immBits)))) {
        throw new Error(`Required immediate is too wide.`);
    } else if (r / 2 > Math.pow(2, rotBits)) {
        throw new Error('Required rotation is too large.');
    }

    return [r / 2, n.toInt()];
}

export { encodeWithRotation, rotateRight, rotateLeft, logicalShiftRight, arithmeticShiftRight, logicalShiftLeft }
