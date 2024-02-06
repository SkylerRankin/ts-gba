import { writeFileSync } from 'fs';
import { Display } from "../../emulator/display";
import { byteArrayToBitmap } from "../../emulator/image";


test('display', () => {
    const width = 240;
    const height = 160;
    let imageData = Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            imageData[y * width + x] = [
                Math.floor(Math.random() * 255),
                Math.floor(Math.random() * 255),
                Math.floor(Math.random() * 255)
            ];
        }
    }

    const bitmap = byteArrayToBitmap(imageData, width, height);
    writeFileSync("bitmap_output.bmp", bitmap);

    let d = new Date().toLocaleDateString();
    console.log(d);

    fail("this is not a real test!");

});

