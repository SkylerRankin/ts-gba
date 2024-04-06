const rotateRight = (n: number, r: number, bits: number) : number => {
    return ((n >>> r) | (n << (bits - r))) & (Math.pow(2, bits) - 1);
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
    if (s === 0) return [n, 0];
    return [n << s >>> 0, (n >>> (32 - s)) & 0x1];
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
    let result = 0;

    if (bigEndian) {
        for (let i = 0; i < a.length; i++) {
            result |= a[i] << ((a.length - i - 1) * 8);
        }
    } else {
        for (let i = 0; i < a.length; i++) {
            result |= a[i] << (i * 8);
        }
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
    const a = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
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

const toBigEndianInt32 = (n: number): number => {
    return (
        ((n & 0xff) << 24) +
        ((n & 0xff00) << 8) +
        ((n & 0xff0000) >>> 8) +
        ((n & 0xff000000) >>> 24)
    ) >>> 0;
}

const toBigEndianInt16 = (n: number): number => {
    return (
        ((n & 0xff00) >>> 8) +
        ((n & 0xff) << 8)
    ) >>> 0;
}

const isNegative32 = (n: number): boolean => {
    return (n & 0x80000000) !== 0;
}

const isNegative = (n: number, bits: number): boolean => {
    return ((n >>> (bits - 1)) & 0x1) === 1;   
}

/**
 * Returns 1 if a "borrow" occurs when subtracting a from b. A borrow means that a 1
 * is required to be borrowed into the MSB during the subtraction. This translates to
 * subtracting a larger number from a smaller number, when interpreting the inputs both
 * as unsigned. 
 */
const borrowFrom = (a: number, b: number): number => {
    return ((a & 0xFFFFFFFF) >>> 0) < ((b & 0xFFFFFFFF) >>> 0) ? 1 : 0;
}

const signedOverflowFromSubtraction = (operand1: number, operand2: number, result: number): number => {
    const msb1 = (operand1 >> 31) & 0x1;
    const msb2 = (operand2 >> 31) & 0x1;
    const msbResult = (result >> 31) & 0x1;
    return (msb1 !== msb2 && msb1 !== msbResult) ? 1 : 0;
}

const signedOverflowFromAddition = (operand1: number, operand2: number, result: number): boolean => {
    const value1MSB = (operand1 >>> 31) & 0x1;
    const value2MSB = (operand2 >>> 31) & 0x1;
    const resultMSB = (result >>> 31) & 0x1;
    return (value1MSB === value2MSB && value1MSB !== resultMSB);
}

const twosComplementNegation = (n: number) : number => {
    return ((~n + 1) & 0xFFFFFFFF) >>> 0;
}

/**
 * Register values are 32 bit, but for the purposes of JavaScript runtimes,
 * a 32 bit value with bit 31 set won't be considered negative. This may
 * messes up signed multiplication on 32 bit values, for instance. This function
 * converts a 32 bit signed value to the native JS number form, retaining
 * the sign.
 */
const value32ToNative = (n: number) : number => {
    if (isNegative32(n)) {
        return twosComplementNegation(n) * -1;
    } else {
        return n;
    }
}

const parseNumericLiteral = (s: string) : number => {
    if (s.startsWith("0b")) {
        return Number.parseInt(s.substring(2), 2);
    } else if (s.startsWith("0x")) {
        return Number.parseInt(s.substring(2), 16);
    } else {
        return Number.parseInt(s, 10);
    }
}

const wordAlignAddress = (address: number) : number => {
    return address & 0xFFFFFFFC;
}

const halfWordAlignAddress = (address: number) : number => {
    return address & 0xFFFFFFFE;
}

export { rotateRight, rotateLeft, logicalShiftRight,
    arithmeticShiftRight, logicalShiftLeft, signExtend, byteArrayToInt32,
    int32ToByteArray, int16ToByteArray, int8ToByteArray, numberOfSetBits,
    asHex, toBigEndianInt32, toBigEndianInt16, isNegative32, borrowFrom,
    signedOverflowFromSubtraction, signedOverflowFromAddition, twosComplementNegation,
    isNegative, value32ToNative, parseNumericLiteral, wordAlignAddress, halfWordAlignAddress
}
