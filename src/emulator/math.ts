import Long from 'long';

const rotateRight = (n: number, r: number, bits: number) : number => {
    return ((n >> r) | (n << (bits - r))) & (Math.pow(2, bits) - 1);
}

const rotateLeft = (n: number, r: number, bits: number) : number => {
    return ((n << r) | (n >> (bits - r))) & (Math.pow(2, bits) - 1);
}

// Returns [value, carry out]
const logicalShiftRight = (n: number, s: number) : number[] => {
    if (s > 32) return [0, 0];
    if (s === 32) return [0, (n >>> 31) & 0x1];
    return [n >>> s, (n >>> (s - 1)) & 0x1];
}

// Returns [value, carry out]
const arithmeticShiftRight = (n: number, s: number) : number[] => {
    const carry = (n >> (s - 1)) & 0x1;
    if (s > 32) return [n < 0 ? -1 : 0, n < 0 ? 1 : 0];
    if (s === 32) return n < 0 ? [-1, carry] : [0, carry];
    return [n >> s, carry];
}

// Returns [value, carry out]
const logicalShiftLeft = (n: number, s: number) : number[] => {
    if (s > 32) return [0, 0];
    if (s === 32) return [0, n & 0x1];
    return [n << s, (n >>> (32 - s)) & 0x1];
}

// Converts a number n into values r and i such that n = i >> 2r. This operation (>>) is a right rotation.
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

// Sign extends a number n in `bits` bits to the same number in 32 bits.
const signExtend = (n: number, bits: number) : number => {
    if (((n >>> (bits - 1)) & 0x1) === 0 || bits === 32) {
        return n & (2**bits - 1);
    } else {
        const diff = 32 - bits;
        return (n & (2**bits - 1)) | ((2**diff - 1) << bits);
    }
}

const byteArrayToInt32 = (a: Uint8Array, bigEndian: boolean) : number => {
    const data = new Uint8Array(a);
    if (bigEndian) data.reverse();
    let result = 0;
    for (let i = 0; i < data.length; i++) {
        result |= data[i] << (i * 8);
    }
    return result >>> 0;
}

const int32ToByteArray = (n: number, bigEndian: boolean) : Uint8Array => {
    return intToByteArray(n, bigEndian, 4);
}

const int16ToByteArray = (n: number, bigEndian: boolean) : Uint8Array => {
    return intToByteArray(n, bigEndian, 2);
}

const int8ToByteArray = (n: number, bigEndian: boolean) : Uint8Array => {
    return intToByteArray(n, bigEndian, 1);
}

const intToByteArray = (n: number, bigEndian: boolean, bytes: number) : Uint8Array => {
    const a = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
        a[i] = (n >>> (i * 8)) & 0xFF;
    }
    if (bigEndian) a.reverse();
    return a;
}

const numberOfSetBits = (n: number) : number => {
    let count = 0;
    while (n > 0) {
        count += n & 0x1;
        n = n >> 1;
    }
    return count;
}

const asHex = (n: number) : string => {
    return '0x' + n.toString(16).padStart(8, '0');
}

export { encodeWithRotation, rotateRight, rotateLeft, logicalShiftRight,
    arithmeticShiftRight, logicalShiftLeft, signExtend, byteArrayToInt32,
    int32ToByteArray, int16ToByteArray, int8ToByteArray, numberOfSetBits,
    asHex }
