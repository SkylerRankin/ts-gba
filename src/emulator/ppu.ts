import { Display, RGBColor } from "./display";
import { byteArrayToInt32 } from "./math";
import { Memory, MemorySegments } from "./memory";

interface PPUType {
    step(cpuCycles: number) : void;
}

type DisplayRegister =
    'DISPCNT' |     // LCD Control
    'DISPSTAT' |    // General LCD Status
    'VCOUNT' |      // Vertical Counter
    'BG0CNT' |      // Background 0 Control
    'BG1CNT' |      // Background 1 Control
    'BG2CNT' |      // Background 2 Control
    'BG3CNT'        // Background 3 Control
;

type DisplayState = 'hDraw' | 'hBlank' | 'vBlank';

const DisplayConstants = {
    cyclesPerPixel: 4,
    hDrawPixels: 240,
    hDrawCycles: 240 * 4,
    hBlankPixels: 68,
    hBlankCycles: 68 * 6,
    scanlineLength: 1232,
    vDrawPixels: 160,
    vBlankPixels: 68,
    vBlankCycles: 68 * (240 + 68) * 4,
};


const displayRegisters: {[key in DisplayRegister]: number} = {
    DISPCNT: 0x04000000,
    DISPSTAT: 0x04000004,
    VCOUNT: 0x04000006,
    BG0CNT: 0x04000008,
    BG1CNT: 0x0400000A,
    BG2CNT: 0x0400000C,
    BG3CNT: 0x0400000E,
};


class PPU implements PPUType {

    memory: Memory;
    display: Display;
    currentScanline: number;
    displayState: DisplayState;
    displayStateStart: number;
    nextCycleTrigger: number;
    // A flag read and modified by core GBA to know when a frame has completed rendering.
    vBlankAck: boolean;

    constructor(memory: Memory, display: Display) {
        this.memory = memory;
        this.display = display;
        this.currentScanline = -1;
        this.displayState = 'vBlank';
        this.displayStateStart = 0;
        this.nextCycleTrigger = 0;
        this.vBlankAck = false;
    }

    renderScanline(y: number) {
        const displayControl = this.memory.getBytes(displayRegisters.DISPCNT, 2);
        const displayMode = displayControl[0] & 0x7;
        
        switch (displayMode) {
            case 0x0:
                console.log('Display mode 0 not implemented.');
                break;
            case 0x1:
                console.log('Display mode 1 not implemented.');
                break;
            case 0x2:
                console.log('Display mode 2 not implemented.');
                break;
            case 0x3:
                this.renderDisplayMode3Scanline(y, displayControl);
                break;
            case 0x4:
                console.log('Display mode 4 not implemented.');
                break;
            case 0x5:
                console.log('Display mode 5 not implemented.');
                break;
            default:
                throw Error(`Invalid display mode (${displayMode}) in DISPCNT.`);
        }

    }

    /**
     * Triggered on each CPU clock tick. Since the CPU clock is running at a different
     * frequency than the PPU clock, PPU actions are only triggered after a certain number
     * of cycles have passed. For instance, after (240 * 4) cycles, vDraw should end. At these
     * points, a batch of PPU operations are completed all at once, such as drawing a
     * scanline.
     * 
     * @param cpuCycles The number of cycles completed by the CPU.
     */
    step(cpuCycles: number) {
        // Not enough cycles have passed to enter next PPU stage.
        if (cpuCycles < this.nextCycleTrigger) {
            return;
        }

        switch (this.displayState) {
            case 'hDraw':
                // V Draw completed
                this.displayState = 'hBlank';
                this.nextCycleTrigger = cpuCycles + DisplayConstants.hBlankCycles;
                break;
            case 'hBlank':
                // H Blank completed
                if (this.currentScanline < DisplayConstants.vDrawPixels - 1) {
                    this.currentScanline += 1;
                    this.displayState = 'hDraw';
                    this.nextCycleTrigger = cpuCycles + DisplayConstants.hDrawCycles;
                    this.renderScanline(this.currentScanline);
                } else {
                    this.displayState = 'vBlank';
                    this.nextCycleTrigger = cpuCycles + DisplayConstants.vBlankCycles;
                    this.vBlankAck = true;
                }
                break;
            case 'vBlank':
                // V Blank completed, move back to first scanline
                this.displayState = 'hDraw';
                this.currentScanline = 0;
                this.nextCycleTrigger = cpuCycles + DisplayConstants.hDrawCycles;
                break;
        }
    }

    
    renderDisplayMode3Scanline(y: number, displayControl: Uint8Array) {
        const backgroundFlags = displayControl[1] & 0xF;
        if (backgroundFlags !== 0b0100) {
            throw Error(`Display mode 3 required only background 2 enabled.`);
        }

        const bytesPerPixel = 2;
        const baseAddress = MemorySegments.VRAM.start + (y * DisplayConstants.hDrawPixels * bytesPerPixel);

        for (let x = 0; x < DisplayConstants.hBlankPixels; x++) {
            const address = baseAddress + (x * bytesPerPixel);
            const colorData = byteArrayToInt32(this.memory.getBytes(address, 2), false);
            const rgbColor: RGBColor = {
                red: (colorData & 0x1F) / 32,
                green: ((colorData >>> 5) & 0x1F) / 32,
                blue: ((colorData >>> 10) & 0x1F) / 32,
            };
            this.display.setPixel(x, y, rgbColor);
        }
    }

    renderDisplayMode4Scanline(y: number, displayControl: Uint8Array) {
        const backgroundFlags = displayControl[1] & 0xF;
        if (backgroundFlags !== 0b0100) {
            throw Error(`Display mode 4 required only background 2 enabled.`);
        }

        const background3Control = this.memory.getBytes(0x0400000E, 2);
        const backgroundPaletteAddress = 0x05000000;
        const baseAddress = MemorySegments.VRAM.start + (y * DisplayConstants.hDrawPixels);

        for (let x = 0; x < DisplayConstants.hBlankPixels; x++) {
            const address = baseAddress + x;
            const paletteData = byteArrayToInt32(this.memory.getBytes(address, 1), false);
            const colorData = 0;
            const rgbColor: RGBColor = {
                red: (colorData & 0x1F) / 32,
                green: ((colorData >>> 5) & 0x1F) / 32,
                blue: ((colorData >>> 10) & 0x1F) / 32,
            };
            this.display.setPixel(x, y, rgbColor);
        }


    }

}


export { PPU }
export type { PPUType }
