import { byteArrayToInt32 } from "./math";

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
            bmp[i++] = colorData[y * width + x][2];
            bmp[i++] = colorData[y * width + x][1];
            bmp[i++] = colorData[y * width + x][0];
        }
        for (let x = 0; x < rowPaddingBytes; x++) {
            bmp[i++] = 0;
        }
    }

    return bmp;
}

const compareBitmaps = (image1: Uint8Array, image2: Uint8Array) => {
    const image1Width = byteArrayToInt32(image1.subarray(18, 22), false);
    const image1Height = byteArrayToInt32(image1.subarray(22, 26), false);
    const image2Width = byteArrayToInt32(image2.subarray(18, 22), false);
    const image2Height = byteArrayToInt32(image2.subarray(22, 26), false);

    if (image1Width !== image2Width || image1Height !== image2Height) {
        return { equal: false, message: `Image sizes do not match: (${image1Width} x ${image1Height}) vs (${image2Width} x ${image2Height})}` };
    }

    const bitsPerPixel = 24;
    const bytesPerPixel = 3;
    const rowPaddingBytes = ((bitsPerPixel * image1Width) % 32) / 8;

    const headerSize = 54;
    const rowSize = (image1Width * bytesPerPixel) + rowPaddingBytes;
    for (let y = 0; y < image1Height; y++) {
        for (let x = 0; x < image1Width; x++) {
            for (let i = 0; i < 3; i++) {
                let j = headerSize + (y * rowSize) + (x * bytesPerPixel) + i;
                if (image1[j] !== image2[j]) {
                    const channel = ["red", "green", "blue"][i];
                    return { equal: false, message: `Mismatch at pixel (${x}, ${160 - y - 1}) and channel ${channel}: ${image1[j]} vs ${image2[j]}.` };
                }
            }
        }
    }

    return { equal: true, message: "" };
}

export { byteArrayToBitmap, compareBitmaps };
