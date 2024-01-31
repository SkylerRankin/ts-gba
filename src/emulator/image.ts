
/**
 * Formats an RGB color array into a bitmap image formatted Uint8Array.
 * @param colorData A 2d array of RGB values in the range [0, 255], shape [width * height, 3]
 * @param width 
 * @param height 
 */
const byteArrayToBitmap = (colorData: number[][], width: number, height: number) => {
    if (colorData.length !== (width * height)) {
        throw Error(`Color data array length (${colorData.length}) does not match provided image size (${width} x ${height}).`);
    }

    const bmpHeaderSize = 14;
    const dibHeaderSize = 40;
    const bitsPerPixel = 24;
    const rowPaddingBytes = ((bitsPerPixel * width) % 32) / 8;
    const totalSize = bmpHeaderSize + dibHeaderSize + (width * height * 3) + (rowPaddingBytes * height);

    const bmpHeader = [
        0x42, 0x4D, // ID (BM)
        totalSize & 0xFF, (totalSize >> 8) & 0xFF, (totalSize >> 16) & 0xFF, (totalSize >> 24) & 0xFF, // File size
        0x0, 0x0, // Unused
        0x0, 0x0, // Unused
        0x1A, 0x0, 0x0, 0x0 // Pixel array offset
    ];

    const dibHeader = [
        0x28, 0x0, 0x0, 0x0, // Header size (40 bytes)
        width & 0xFF, (width >> 8) & 0xFF, (width >> 16) & 0xFF, (width >> 24) & 0xFF, // Bitmap width
        height & 0xFF, (height >> 8) & 0xFF, (height >> 16) & 0xFF, (height >> 24) & 0xFF, // Bitmap height
        0x1, 0x0, // Color planes, always 1
        0x18, 0x0, // Bits per pixel
        0x0, 0x0, 0x0, 0x0, // Compression, 0 for no compression
        0x0, 0x0, 0x0, 0x0, // Size of bitmap data
        0x13, 0xB, 0x0, 0x0, // Horizontal resolution
        0x13, 0xB, 0x0, 0x0, // Vertical resolution
        0x0, 0x0, 0x0, 0x0, // Colors in palette
        0x0, 0x0, 0x0, 0x0, // Color importance
    ];

    const bmp = new Uint8Array(totalSize);
    let i = 0;
    bmpHeader.forEach(b => { bmp[i++] = b; });
    dibHeader.forEach(b => { bmp[i++] = b; });

    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            bmp[i++] = colorData[y * width + x][0];
            bmp[i++] = colorData[y * width + x][1];
            bmp[i++] = colorData[y * width + x][2];
        }
        for (let x = 0; x < rowPaddingBytes; x++) {
            bmp[i++] = 0;
        }
    }

    return bmp;
}

export { byteArrayToBitmap };
