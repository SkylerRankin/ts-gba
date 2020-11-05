
const rotateRight = (n: number, r: number, bits: number) : number => {
    return ((n >> r) | (n << (bits - r))) & (Math.pow(2, bits) - 1);
}

const rotateLeft = (n: number, r: number, bits: number) : number => {
    return ((n << r) | (n >> (bits - r))) & (Math.pow(2, bits) - 1);
}

// Converts an number n into values r and i such that n = i >> r. This operation (>>) is a right rotation.
// The i value is 8 bits, the r value is 4 bits. Returns an array [rotation, value].
const encodeWithRotation = (n:number, bits:number, immBits: number) : number[] => {
    if (n >= 0 && n <= Math.pow(immBits, 2) - 1) return [0, n];
    let r = 0;
    while ((n < 0 || n > Math.pow(immBits, 2) - 1) && r < bits) {
        console.log(`n=${n} : ${n.toString(2).padStart(bits, '0')} r=${r}`);
        n = ((n << 1) | (n >> (bits - 1))) & (Math.pow(2, bits) - 1);
        r++;
    }
    return [r, n];
}

export { encodeWithRotation, rotateRight, rotateLeft }
