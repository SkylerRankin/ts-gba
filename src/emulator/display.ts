import { writeFileSync } from "fs";
import { byteArrayToBitmap } from "./image";

type RGBColor = {
    red: number,
    green: number,
    blue: number
}

const displaySize = {
    width: 240,
    height: 160
};

class Display {

    buffer: number[][];

    constructor() {
        this.buffer = Array(displaySize.width * displaySize.height);
        this.reset();
    }

    setPixel(x: number, y: number, color: RGBColor) {
        this.buffer[y * displaySize.width + x][0] = color.red;
        this.buffer[y * displaySize.width + x][1] = color.green;
        this.buffer[y * displaySize.width + x][2] = color.blue;
    }

    load(display: Display) {
        for (let i = 0; i < this.buffer.length; i++) {
            for (let j = 0; j < this.buffer[i].length; j++) {
                this.buffer[i][j] = display.buffer[i][j];
            }
        }
    }

    saveToFile() {
        const bitmap = byteArrayToBitmap(this.buffer, displaySize.width, displaySize.height);
        const date = new Date();
        const filename = `./logs/display/gba_display_output_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.bmp`;
        writeFileSync(filename, bitmap);
    }

    reset() {
        for (let i = 0; i < this.buffer.length; i++) {
            this.buffer[i] = [0, 0, 0];
        }
    }

}

export { Display };
export type { RGBColor };
