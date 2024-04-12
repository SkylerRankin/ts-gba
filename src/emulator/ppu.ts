import { CPU } from "./cpu";
import { Display, RGBColor } from "./display";
import { requestInterrupt } from "./interrupt";
import { byteArrayToInt32, mod, signExtend } from "./math";
import { Memory, MemorySegments } from "./memory";

interface PPUType {
    step(cpuCycles: number) : void;
    reset() : void;
}

type DisplayRegister =
    'DISPCNT' |     // LCD Control
    'DISPSTAT' |    // General LCD Status
    'VCOUNT' |      // Vertical Counter
    'BG0CNT' |      // Background 0 Control
    'BG1CNT' |      // Background 1 Control
    'BG2CNT' |      // Background 2 Control
    'BG3CNT' |      // Background 3 Control
    'BG0HOFS' |     // Background 0 Horizontal Offset
    'BG0VOFS' |     // Background 0 Vertical Offset
    'BG1HOFS' |     // Background 1 Horizontal Offset
    'BG1VOFS' |     // Background 1 Vertical Offset
    'BG2HOFS' |     // Background 2 Horizontal Offset
    'BG2VOFS' |     // Background 2 Vertical Offset
    'BG3HOFS' |     // Background 3 Horizontal Offset
    'BG3VOFS' |     // Background 3 Vertical Offset
    'BG2PA' |       // Background 2 Transform Parameter A
    'BG2PB' |       // Background 2 Transform Parameter B
    'BG2PC' |       // Background 2 Transform Parameter C
    'BG2PD' |       // Background 2 Transform Parameter D
    'BG2X' |       // Background 2 Reference Point X
    'BG2Y' |       // Background 2 Reference Point Y
    'BG3PA' |       // Background 3 Transform Parameter A
    'BG3PB' |       // Background 3 Transform Parameter B
    'BG3PC' |       // Background 3 Transform Parameter C
    'BG3PD' |       // Background 3 Transform Parameter D
    'BG3X' |       // Background 3 Reference Point X
    'BG3Y' |       // Background 3 Reference Point Y
    'WIN0H' |       // Window 0 Horizontal Dimensions
    'WIN1H' |       // Window 1 Horizontal Dimensions
    'WIN0V' |       // Window 0 Vertical Dimensions
    'WIN1V' |       // Window 1 Vertical Dimensions
    'WININ' |       // Control of Inside of Windows
    'WINOUT'        // Control of Outside of Windows and Inside OBJ Window
;

type DisplayState = 'hDraw' | 'hBlank' | 'vBlank';
type PPUStepFlags = { hBlank: boolean, vBlank: boolean };
type AffineReferencePoint = { x: number, y: number };

const DisplayConstants = {
    cyclesPerPixel: 4,
    hDrawPixels: 240,
    hDrawCycles: 240 * 4,
    hBlankPixels: 68,
    hBlankCycles: 68 * 4,
    scanlineLength: 1232,
    vDrawPixels: 160,
    vBlankPixels: 68,
    vBlankCycles: 68 * (240 + 68) * 4,
    displayMode5Width: 160,
    displayMode5Height: 128,
};

type DisplayMode4Config = {
    currentFrame: number,
};

type DisplayMode5Config = {
    currentFrame: number,
};

type ScanlineSegment = { min: number, max: number, controls: number };

const displayRegisters: {[key in DisplayRegister]: number} = {
    DISPCNT: 0x04000000,
    DISPSTAT: 0x04000004,
    VCOUNT: 0x04000006,
    BG0CNT: 0x04000008,
    BG1CNT: 0x0400000A,
    BG2CNT: 0x0400000C,
    BG3CNT: 0x0400000E,
    BG0HOFS: 0x04000010,
    BG0VOFS: 0x04000012,
    BG1HOFS: 0x04000014,
    BG1VOFS: 0x04000016,
    BG2HOFS: 0x04000018,
    BG2VOFS: 0x0400001A,
    BG3HOFS: 0x0400001C,
    BG3VOFS: 0x0400001E,
    BG2PA: 0x04000020,
    BG2PB: 0x04000022,
    BG2PC: 0x04000024,
    BG2PD: 0x04000026,
    BG2X: 0x04000028,
    BG2Y: 0x0400002C,
    BG3PA: 0x04000030,
    BG3PB: 0x04000032,
    BG3PC: 0x04000034,
    BG3PD: 0x04000036,
    BG3X: 0x04000038,
    BG3Y: 0x0400003C,
    WIN0H: 0x04000040,
    WIN1H: 0x04000042,
    WIN0V: 0x04000044,
    WIN1V: 0x04000046,
    WININ: 0x04000048,
    WINOUT: 0x0400004A,
};

const BackgroundMapSizes = {
    TEXT: [
        { x: 256, y: 256 },
        { x: 512, y: 256 },
        { x: 256, y: 512 },
        { x: 512, y: 512 },
    ],
    AFFINE: [
        { x: 128, y: 128 },
        { x: 256, y: 256 },
        { x: 512, y: 512 },
        { x: 1024, y: 1024 },
    ],
};

const BackgroundConstants = {
    charBlockBytes: 0x4000,
    screenBlockBytes: 0x800,
    screenBlockTileSize: 32,
    tilePixelSize: 8,
    backgroundCount: 4,
    screenEntryBytes: 2,
    affineScreenEntryBytes: 1,
};

const SpriteConstants = {
    maxObjectAttributes: 128,
    maxAffineAttributes: 32,
    objectAttributeSize: 8,
    affineObjectAttributeSize: 32,
    size: [ // First index is shape value (attr0), second is size value (attr1)
        [ {x: 8, y: 8}, {x: 16, y: 16}, {x: 32, y: 32}, {x: 64, y: 64} ],
        [ {x: 16, y: 8}, {x: 32, y: 8}, {x: 32, y: 16}, {x: 64, y: 32} ],
        [ {x: 8, y: 16}, {x: 8, y: 32}, {x: 16, y: 32}, {x: 32, y: 64} ],
    ],
    tileSize: 8,
    charBlock4Address: 0x06010000,
    charBlock5Address: 0x06014000,
    spritePaletteAddress: 0x05000200,
    spritePaletteBytes: 32,
    maxVRAMTiles: 1024,
};

class PPU implements PPUType {
    cpu: CPU;
    memory: Memory;
    display: Display;
    currentScanline: number;
    displayState: DisplayState;
    nextCycleTrigger: number;
    // A flag read and modified by core GBA to know when a frame has completed rendering.
    vBlankAck: boolean;
    displayModeState: {[key: string]: DisplayMode4Config | undefined};
    // Flags used by DMA to check when an HBlank or VBlank has occurred.
    stepFlags: PPUStepFlags;
    affineReferencePoints: AffineReferencePoint[];

    constructor(cpu: CPU, display: Display) {
        this.cpu = cpu;
        this.memory = cpu.memory;
        this.display = display;
        this.currentScanline = -1;
        this.displayState = 'vBlank';
        this.nextCycleTrigger = -1;
        this.vBlankAck = false;
        this.displayModeState = {
            "0": undefined,
            "1": undefined,
            "2": undefined,
            "3": undefined,
            "4": {
                currentFrame: 0,
            } as DisplayMode4Config,
            "5": {
                currentFrame: 0,
            } as DisplayMode5Config,
        };
        this.stepFlags = { hBlank: false, vBlank: false };
        this.affineReferencePoints = [
            { x: -1, y: -1 },
            { x: -1, y: -1 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: -1, y: -1 },
            { x: -1, y: -1 },
        ];
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
        this.stepFlags.hBlank = false;
        this.stepFlags.vBlank = false;

        // Not enough cycles have passed to enter next PPU stage.
        if (cpuCycles < this.nextCycleTrigger) {
            return;
        }

        const dispStat = this.cpu.memory.getInt16(displayRegisters.DISPSTAT).value;
        const vBlankIrqEnabled = (dispStat & 0x8) > 0;
        const hBlankIrqEnabled = (dispStat & 0x10) > 0;
        const vCounterIrqEnabled = (dispStat & 0x20) > 0;
        const vCountSetting = (dispStat >> 8) & 0xFF;

        switch (this.displayState) {
            case 'hDraw': {
                // V Draw completed
                this.stepFlags.vBlank = true;
                this.displayState = 'hBlank';
                this.nextCycleTrigger = cpuCycles + DisplayConstants.hBlankCycles;
                this.renderScanline(this.currentScanline);

                // Set H-Blank flag in DISPSTAT
                const dispstat = this.memory.getBytes(displayRegisters.DISPSTAT, 1);
                dispstat[0] = dispstat[0] | 0x2;
                this.memory.setBytes(displayRegisters.DISPSTAT, dispstat);

                break;
            }
            case 'hBlank': {
                // H Blank completed
                this.stepFlags.hBlank = true;

                if (this.currentScanline < DisplayConstants.vDrawPixels - 1) {
                    this.currentScanline += 1;
                    this.memory.setBytes(displayRegisters.VCOUNT, new Uint8Array([this.currentScanline, 0]));
                    this.displayState = 'hDraw';
                    this.nextCycleTrigger = cpuCycles + DisplayConstants.hDrawCycles;
                } else {
                    this.currentScanline += 1;
                    this.displayState = 'vBlank';

                    // Set V-Blank flag in DISPSTAT
                    const dispstat = this.memory.getBytes(displayRegisters.DISPSTAT, 2);
                    dispstat[0] = dispstat[0] | 0x1;
                    this.memory.setBytes(displayRegisters.DISPSTAT, dispstat);

                    this.nextCycleTrigger = cpuCycles + DisplayConstants.hDrawCycles + DisplayConstants.hBlankCycles;
                    this.display.drawFrame();
                }

                // Clear H-Blank flag in DISPSTAT
                const dispstat = this.memory.getBytes(displayRegisters.DISPSTAT, 1);
                dispstat[0] = dispstat[0] & 0xFD;
                this.memory.setBytes(displayRegisters.DISPSTAT, dispstat);

                // Request H-Blank interrupt
                if (hBlankIrqEnabled) {
                    requestInterrupt(this.cpu, "H_Blank");
                }
                break;
            }
            case 'vBlank': {
                if (this.currentScanline < (DisplayConstants.vDrawPixels + DisplayConstants.hBlankPixels - 1)) {
                    // Completed empty V-Draw scanline
                    this.currentScanline += 1;
                    this.memory.setBytes(displayRegisters.VCOUNT, new Uint8Array([this.currentScanline, 0]));
                    this.nextCycleTrigger = cpuCycles + DisplayConstants.hDrawCycles + DisplayConstants.hBlankCycles;

                    // Request hidden H-Blank interrupt
                    if (hBlankIrqEnabled) {
                        requestInterrupt(this.cpu, "H_Blank");
                    }
                } else {
                    // Completed all V-Blank empty scanlines, returning to top scanline.
                    this.vBlankAck = true;
                    this.displayState = 'hDraw';
                    this.currentScanline = 0;
                    this.memory.setBytes(displayRegisters.VCOUNT, new Uint8Array([this.currentScanline, 0]));
                    this.nextCycleTrigger = cpuCycles + DisplayConstants.hDrawCycles;

                    // Clear V-Blank flag in DISPSTAT
                    const dispstat = this.memory.getBytes(displayRegisters.DISPSTAT, 2);
                    dispstat[0] = dispstat[0] & 0xFE;
                    this.memory.setBytes(displayRegisters.DISPSTAT, dispstat);

                    // The affine background reference points are loaded into internal registers on each VBlank.
                    this.loadAffineBackgroundReferencePoints();

                    // Request V-Blank interrupt
                    if (vBlankIrqEnabled) {
                        requestInterrupt(this.cpu, "V_Blank");
                    }
                }
                break;
            }
        }

        if (vCounterIrqEnabled && this.currentScanline === vCountSetting) {
            requestInterrupt(this.cpu, "V_Counter_Match");
        }
    }

    reset() {
        this.currentScanline = 0;
        this.memory.setBytes(displayRegisters.VCOUNT, new Uint8Array([0, 0]));
        this.displayState = 'hDraw';
        this.nextCycleTrigger = DisplayConstants.hDrawCycles;
        this.vBlankAck = false;
    }

    renderScanline(y: number) {
        const displayControl = this.memory.getInt16(displayRegisters.DISPCNT).value;
        const displayMode = displayControl & 0x7;

        switch (displayMode) {
            case 0x0:
                this.renderDisplayMode0Scanline(y, displayControl);
                break;
            case 0x1:
                this.renderDisplayMode1Scanline(y, displayControl);
                break;
            case 0x2:
                this.renderDisplayMode2Scanline(y, displayControl);
                break;
            case 0x3:
                this.renderDisplayMode3Scanline(y, displayControl);
                break;
            case 0x4:
                this.renderDisplayMode4Scanline(y, displayControl);
                break;
            case 0x5:
                this.renderDisplayMode5Scanline(y, displayControl);
                break;
            default:
                throw Error(`Invalid display mode (${displayMode}) in DISPCNT.`);
        }

    }

    renderDisplayMode0Scanline(y: number, displayControl: number) {
        // Display mode 0 allows for backgrounds 0 - 3 with no transformations on any background.

        this.fillBackgroundColor(y);
        const scanlineControls = this.getScanlineControls(y, displayControl);

        // Render backgrounds
        for (let backgroundIndex = 0; backgroundIndex <= 3; backgroundIndex++) {
            const backgroundEnabled = ((displayControl >> (backgroundIndex + 8)) & 0x1) === 1;
            if (backgroundEnabled) {
                this.renderTiledBackgroundScanline(y, displayControl, backgroundIndex, scanlineControls);
            }
        }

        // Render sprites
        this.renderSpritesScanline(y, displayControl, scanlineControls);
    }

    renderDisplayMode1Scanline(y: number, displayControl: number) {
        // Display mode 1 allows for backgrounds 0 - 2 with transformations allowed
        // only on background 2.

        this.fillBackgroundColor(y);
        const scanlineControls = this.getScanlineControls(y, displayControl);

        // Render backgrounds
        for (let backgroundIndex = 0; backgroundIndex <= 1; backgroundIndex++) {
            const backgroundEnabled = ((displayControl >> (backgroundIndex + 8)) & 0x1) === 1;
            if (backgroundEnabled) {
                this.renderTiledBackgroundScanline(y, displayControl, backgroundIndex, scanlineControls);
            }
        }

        const background2Index = 2;
        const background2Enabled = ((displayControl >> (background2Index + 8)) & 0x1) === 1;
        if (background2Enabled) {
            this.renderAffineTiledBackgroundScanline(y, displayControl, background2Index, scanlineControls);
        }

        // Render sprites
        this.renderSpritesScanline(y, displayControl, scanlineControls);
    }

    renderDisplayMode2Scanline(y: number, displayControl: number) {
        // Display mode 2 allows for backgrounds 2 - 3, with transformations allowed
        // on both background.

        this.fillBackgroundColor(y);
        const scanlineControls = this.getScanlineControls(y, displayControl);

        // Render backgrounds
        for (let backgroundIndex = 2; backgroundIndex <= 3; backgroundIndex++) {
            const backgroundEnabled = ((displayControl >> (backgroundIndex + 8)) & 0x1) === 1;
            if (backgroundEnabled) {
                this.renderAffineTiledBackgroundScanline(y, displayControl, backgroundIndex, scanlineControls);
            }
        }

        // Render sprites
        this.renderSpritesScanline(y, displayControl, scanlineControls);
    }

    renderDisplayMode3Scanline(y: number, displayControl: number) {
        const backgroundFlags = (displayControl >> 8) & 0xF;
        if (backgroundFlags !== 0b0100) {
            throw Error(`Display mode 3 requires only background 2 enabled.`);
        }

        const bytesPerPixel = 2;
        const baseAddress = MemorySegments.VRAM.start + (y * DisplayConstants.hDrawPixels * bytesPerPixel);

        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            const address = baseAddress + (x * bytesPerPixel);
            const rgbColor = this.get15BitColorFromAddress(address);
            this.display.setPixel(x, y, rgbColor);
        }
    }

    renderDisplayMode4Scanline(y: number, displayControl: number) {
        const backgroundFlags = (displayControl >> 8) & 0xF;
        if (backgroundFlags !== 0b0100) {
            throw Error(`Display mode 4 requires only background 2 enabled.`);
        }

        const state = this.displayModeState["4"] as DisplayMode4Config;
        const frame = (displayControl >> 4) & 0x1;
        if (frame !== state.currentFrame) {
            // Previous scanline was rendered to a different frame. Load in the new frame before
            // writing and save previous before rendering the next scanline.
            this.display.setFrame(frame);
            state.currentFrame = frame;
        }

        const backgroundPaletteAddress = 0x05000000;
        const frameStartAddress = MemorySegments.VRAM.start + (frame === 0 ? 0 : 0xA000);
        const baseAddress = frameStartAddress + (y * DisplayConstants.hDrawPixels);

        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            const paletteIndexAddress = baseAddress + x;
            const paletteIndex = byteArrayToInt32(this.memory.getBytes(paletteIndexAddress, 1), false);
            // Palette colors occupy 16 bits, so index is multiplied by 2 to get correct byte offset.
            const paletteColorAddress = backgroundPaletteAddress + (paletteIndex * 0x2);
            const rgbColor = this.get15BitColorFromAddress(paletteColorAddress);
            this.display.setPixel(x, y, rgbColor);
        }
    }

    renderDisplayMode5Scanline(y: number, displayControl: number) {
        const backgroundFlags = (displayControl >> 8) & 0xF;
        if (backgroundFlags !== 0b0100) {
            throw Error(`Display mode 5 requires only background 2 enabled.`);
        }

        const state = this.displayModeState["5"] as DisplayMode5Config;
        const frame = (displayControl >> 4) & 0x1;
        if (frame !== state.currentFrame) {
            // Previous scanline was rendered to a different frame. Load in the new frame before
            // writing and save previous before rendering the next scanline.
            this.display.setFrame(0);
            state.currentFrame = frame;
        }

        const bytesPerPixel = 2;
        const baseAddress = MemorySegments.VRAM.start + (y * DisplayConstants.displayMode5Width * bytesPerPixel);

        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            let rgbColor;
            if (x < DisplayConstants.displayMode5Width && y < DisplayConstants.displayMode5Height) {
                const address = baseAddress + (x * bytesPerPixel);
                rgbColor = this.get15BitColorFromAddress(address);
            } else {
                rgbColor = { red: 255, green: 0, blue: 255 };
            }
            this.display.setPixel(x, y, rgbColor);
        }

    }

    get15BitColorFromAddress(address: number) : RGBColor {
        const colorData = this.memory.getInt16(address).value;
        return {
            red: 255 * ((colorData >>> 0) & 0x1F) / 32,
            green: 255 * ((colorData >>> 5) & 0x1F) / 32,
            blue: 255 * ((colorData >>> 10) & 0x1F) / 32,
        };
    }

    fillBackgroundColor(y: number) {
        const backgroundColor = this.get15BitColorFromAddress(MemorySegments.PALETTE.start);
        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            this.display.setPixel(x, y, backgroundColor);
        }
    }

    renderTiledBackgroundScanline(y: number, displayControl: number, backgroundIndex: number, scanlineControls: number[]) {
        // Check if background is disabled
        if (((displayControl >> (backgroundIndex + 8)) & 0x1) === 0) {
            return;
        }

        const backgroundControl = this.memory.getInt16(displayRegisters[`BG${backgroundIndex}CNT` as DisplayRegister]).value;
        const priority = backgroundControl & 0x3;
        const characterBaseBlock = (backgroundControl >> 2) & 0x3;
        const mosaic = (backgroundControl >> 6) & 0x1;
        const paletteMode = (backgroundControl >> 7) & 0x1;
        const screenBaseBlock = (backgroundControl >> 8) & 0x1F;
        const backgroundSizeMode = (backgroundControl >> 14) & 0x3;
        const backgroundSize = BackgroundMapSizes.TEXT[backgroundSizeMode];

        const scrolling = {
            x: this.memory.getInt16(displayRegisters[`BG${backgroundIndex}HOFS` as DisplayRegister]).value & 0x1FF,
            y: this.memory.getInt16(displayRegisters[`BG${backgroundIndex}VOFS` as DisplayRegister]).value & 0x1FF,
        };

        const charBlockStart = MemorySegments.VRAM.start + BackgroundConstants.charBlockBytes * characterBaseBlock;
        const screenBlockBaseStart = MemorySegments.VRAM.start + BackgroundConstants.screenBlockBytes * screenBaseBlock;

        const adjustedY = (y + scrolling.y) % backgroundSize.y;
        const tileY = Math.floor(adjustedY / BackgroundConstants.tilePixelSize) % BackgroundConstants.screenBlockTileSize;
        const yTileOffset = adjustedY % BackgroundConstants.tilePixelSize;

        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            if (((scanlineControls[x] >> backgroundIndex) & 0x1) === 0) {
                // This background is enabled in DISPCNT, but not in the corresponding window control value.
                continue;
            }

            const adjustedX = (x + scrolling.x) % backgroundSize.x;
            const tileX = Math.floor(adjustedX / BackgroundConstants.tilePixelSize) % BackgroundConstants.screenBlockTileSize;
            const xTileOffset = adjustedX % BackgroundConstants.tilePixelSize;

            // Determine which screen block contains this pixel.
            // TODO: refactor this to remove branches, can probably achieve the same thing with division/floor.
            let screenBlockOffset = 0;
            switch (backgroundSizeMode) {
                case 0x0:
                    // 32x32 tiles, 1 screen block
                    screenBlockOffset = 0;
                    break;
                case 0x1:
                    // 64x32, 2 screen blocks in horizontal arrangement
                    screenBlockOffset = (adjustedX < backgroundSize.x / 2) ? 0 : 1;
                    break;
                case 0x2:
                    // 32x64, 2 screen blocks in vertical arrangement
                    screenBlockOffset = (adjustedY < backgroundSize.y / 2) ? 0 : 1;
                    break;
                case 0x3:
                    // 64x64, 4 screen blocks in clockwise square arrangement
                    if (adjustedX < backgroundSize.x / 2) {
                        screenBlockOffset = (adjustedY < backgroundSize.y / 2) ? 0 : 2;
                    } else {
                        screenBlockOffset = (adjustedY < backgroundSize.y / 2) ? 1 : 3;
                    }
                    break;
            }
            const screenBlockStart = screenBlockBaseStart + BackgroundConstants.screenBlockBytes * screenBlockOffset;

            // Find and decompose the screen entry. It occupies 2 bytes.
            const screenEntry = this.memory.getInt16(screenBlockStart + BackgroundConstants.screenEntryBytes * (tileY * BackgroundConstants.screenBlockTileSize + tileX)).value;
            const tileIndex = screenEntry & 0x3FF;
            const horizontalFlip = (screenEntry >> 10) & 0x1;
            const verticalFlip = (screenEntry >> 11) & 0x1;
            const palette = (screenEntry >> 12) & 0xF;

            const mirroredXTileOffset = horizontalFlip ? (BackgroundConstants.tilePixelSize - xTileOffset - 1) : xTileOffset;
            const mirroredYTileOffset = verticalFlip ? (BackgroundConstants.tilePixelSize - yTileOffset - 1) : yTileOffset;

            // Start of this particular palette within palette RAM. Each uses 32 bytes in 16/16 mode.
            const paletteAddress = MemorySegments.PALETTE.start + (palette * 32);

            // Find and decompose the corresponding tile.
            let tileColor;
            if (paletteMode === 0) {
                // 16/16 palette mode
                const bytesPerTile = 32;
                const bytesPerRow = 4;

                // Get all bytes for the row
                const tileBytes = this.memory.getBytes(charBlockStart + (tileIndex * bytesPerTile) + (mirroredYTileOffset * bytesPerRow), bytesPerRow);
                // Select the specific 4 bit palette index value for this pixel
                const colorIndex = mirroredXTileOffset % 2 === 0 ?
                    tileBytes[mirroredXTileOffset / 2] & 0xF :
                    (tileBytes[Math.floor(mirroredXTileOffset / 2)] >> 4) & 0xF;

                if (colorIndex === 0) {
                    // Transparent
                } else {
                    tileColor = this.get15BitColorFromAddress(paletteAddress + 2 * colorIndex);
                }
            } else {
                // 256/1 palette mode
                const bytesPerTile = 64;
                const bytesPerRow = 8;
                const tileBytes = this.memory.getBytes(charBlockStart + (tileIndex * bytesPerTile) + (mirroredYTileOffset * bytesPerRow), bytesPerRow);
                const colorIndex = tileBytes[mirroredXTileOffset] & 0xFF;
                if (colorIndex === 0) {
                    // Transparent
                } else {
                    tileColor = this.get15BitColorFromAddress(paletteAddress + 2 * colorIndex);
                }
            }

            if (tileColor) {
                this.display.setPixel(x, y, tileColor);
            }
        }
    }

    renderAffineTiledBackgroundScanline(y: number, displayControl: number, backgroundIndex: number, scanlineControls: number[]) { 
        // Check if background is disabled
        if (((displayControl >> (backgroundIndex + 8)) & 0x1) === 0) {
            return;
        }

        const backgroundControl = this.memory.getInt16(displayRegisters[`BG${backgroundIndex}CNT` as DisplayRegister]).value;
        const priority = backgroundControl & 0x3;
        const characterBaseBlock = (backgroundControl >> 2) & 0x3;
        const mosaic = (backgroundControl >> 6) & 0x1;
        const paletteMode = (backgroundControl >> 7) & 0x1;
        const screenBaseBlock = (backgroundControl >> 8) & 0x1F;
        const overflowMode = (backgroundControl >> 13) & 0x1;
        const useWrapping = overflowMode === 1;
        const backgroundSizeMode = (backgroundControl >> 14) & 0x3;
        const backgroundSize = BackgroundMapSizes.AFFINE[backgroundSizeMode];
        const backgroundTileSize = { x: backgroundSize.x / 8, y: backgroundSize.y / 8 };

        const referencePoint = this.affineReferencePoints[backgroundIndex];

        const pa16 = this.memory.getInt16(displayRegisters[`BG${backgroundIndex}PA` as DisplayRegister]).value;
        const pb16 = this.memory.getInt16(displayRegisters[`BG${backgroundIndex}PB` as DisplayRegister]).value;
        const pc16 = this.memory.getInt16(displayRegisters[`BG${backgroundIndex}PC` as DisplayRegister]).value;
        const pd16 = this.memory.getInt16(displayRegisters[`BG${backgroundIndex}PD` as DisplayRegister]).value;

        const fractionStep = 0.00390625;
        const pa = signExtend(pa16 >> 8, 8) + fractionStep * (pa16 & 0xFF);
        const pb = signExtend(pb16 >> 8, 8) + fractionStep * (pb16 & 0xFF);
        const pc = signExtend(pc16 >> 8, 8) + fractionStep * (pc16 & 0xFF);
        const pd = signExtend(pd16 >> 8, 8) + fractionStep * (pd16 & 0xFF);

        const charBlockStart = MemorySegments.VRAM.start + BackgroundConstants.charBlockBytes * characterBaseBlock;
        const screenBlockStart = MemorySegments.VRAM.start + BackgroundConstants.screenBlockBytes * screenBaseBlock;
        const paletteAddress = MemorySegments.PALETTE.start;

        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            if (((scanlineControls[x] >> backgroundIndex) & 0x1) === 0) {
                // This background is enabled in DISPCNT, but not in the corresponding window control value.
                continue;
            }

            // This transform first adds the reference point offset to x and y, then applies the affine matrix transform.
            // The resulting equation, simplified below, is localX = pa * (x1 + x0 - x0) + pb * (y1 + y0 - y0) + x0,
            // where x1 is the global x position and x0 is the reference point position.
            let localX = Math.floor(pa * x + pb * y + referencePoint.x);
            if (useWrapping) {
                localX = mod(localX, backgroundSize.x);
            }
            const tileX = Math.floor(localX / BackgroundConstants.tilePixelSize);
            const tileXOffset = localX % BackgroundConstants.tilePixelSize;

            let localY = Math.floor(pc * x + pd * y + referencePoint.y);
            if (useWrapping) {
                localY = mod(localY, backgroundSize.y);
            }
            const tileY = Math.floor(localY / BackgroundConstants.tilePixelSize);
            const tileYOffset = localY % BackgroundConstants.tilePixelSize;

            if (localX < 0 || localY < 0 || tileX >= backgroundTileSize.x || tileY >= backgroundTileSize.y) {
                continue;
            }

            const screenEntryAddress = screenBlockStart + (tileX + tileY * backgroundTileSize.x) * BackgroundConstants.affineScreenEntryBytes;
            const screenEntry = this.memory.getInt8(screenEntryAddress).value;

            // Screen entry is just the tile number, 8 bits = 256 tiles to choose from
            const tileIndex = screenEntry;

            // Affine backgrounds can only use 256/1 palette mode
            const bytesPerTile = 64;
            const bytesPerRow = 8;
            const colorIndex = this.memory.getBytes(charBlockStart + (tileIndex * bytesPerTile) + (tileYOffset * bytesPerRow) + tileXOffset, 1)[0];

            if (colorIndex > 0) {
                const tileColor = this.get15BitColorFromAddress(paletteAddress + 2 * colorIndex);
                this.display.setPixel(x, y, tileColor);
            }
        }

        // According to GBATEK, after each scanline, the internal copies of the background reference points are incremented by dmx (pb) and dmy (pa).
        // This seems to break the transformations, is it being some implicitly already?
        // this.affineReferencePoints[backgroundIndex].x += pb;
        // this.affineReferencePoints[backgroundIndex].y += pd;
    }

    renderSpritesScanline(y: number, displayControl: number, scanlineControls: number[]) {
        // 0 = 2D object tile mapping, 1 = 1D object tile mapping
        const objDimension = (displayControl >> 6) & 0x1;

        for (let i = SpriteConstants.maxObjectAttributes - 1; i >= 0; i--) {
            const attr0 = this.memory.getInt16(MemorySegments.OAM.start + i * SpriteConstants.objectAttributeSize + 0).value;
            const attr1 = this.memory.getInt16(MemorySegments.OAM.start + i * SpriteConstants.objectAttributeSize + 2).value;
            const attr2 = this.memory.getInt16(MemorySegments.OAM.start + i * SpriteConstants.objectAttributeSize + 4).value;

            // Attribute 0 components
            const unsignedSpriteY = attr0 & 0xFF;
            const affineMode = (attr0 >> 8) & 0x3;
            const gfxMode = (attr0 >> 10) & 0x3;
            const mosaic = (attr0 >> 12) & 0x1;
            const colorMode = (attr0 >> 13) & 0x1; // 0 = 16/16, 1 = 256/1
            const spriteShape = (attr0 >> 14) & 0x1;

            // Attribute 1 components
            let spriteX = signExtend(attr1 & 0x1FF, 9);
            const affineIndex = (attr1 >> 9) & 0x1F;
            const horizontalFlip = ((attr1 >> 12) & 0x1) && affineMode === 0;
            const verticalFlip = ((attr1 >> 13) & 0x1) && affineMode === 0;
            const spriteSize = (attr1 >> 14) & 0x3;

            // Attribute 2 components
            const tileIndex = attr2 & 0x3FF;
            const priority = (attr2 >> 10) & 0x3;
            const palette = (attr2 >> 12) & 0xF;

            if (affineMode === 0x2) {
                // Sprite rendering is disabled
                continue;
            }

            // To support wrapping y values, use the negative y once the sprite is fully off screen.
            // The y value has 8 bits, so 2^7=128 is the max signed value, plus the max sprite height
            // of 64 gives a threshold of 192. After this y value, the negative y can be used, allowing
            // the sprite to move down from the top of the screen. The x coordinate doesn't require this
            // since it uses 9 bits, and the signed value fully spans the screen width of 240 px.
            let spriteY = unsignedSpriteY > 192 ? signExtend(unsignedSpriteY, 8) : unsignedSpriteY;
            const size = { x: SpriteConstants.size[spriteShape][spriteSize].x, y: SpriteConstants.size[spriteShape][spriteSize].y };
            const tileSize = { x: size.x / SpriteConstants.tileSize, y: size.y / SpriteConstants.tileSize };
            const tilesPerRow = size.x / SpriteConstants.tileSize;
            const bytesPerTileRow = colorMode === 1 ? 8 : 4;
            const bytesPerTile = colorMode === 1 ? 64 : 32;

            const affineSprite = affineMode !== 0;
            const doubleAffineSize = affineMode === 0x3;
            let pa = 1, pb = 0, pc = 0, pd = 1;
            if (affineSprite) {
                const pa16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttributeSize + 6).value;
                const pb16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttributeSize + 14).value;
                const pc16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttributeSize + 22).value;
                const pd16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttributeSize + 30).value;

                pa = signExtend(pa16 >> 8, 8);
                pb = signExtend(pb16 >> 8, 8);
                pc = signExtend(pc16 >> 8, 8);
                pd = signExtend(pd16 >> 8, 8);

                const fractionStep = 0.00390625; // Matrix values are fixed point numbers with 8 bit fractional part, each step is 1 / 256
                pa += (pa16 & 0xFF) * fractionStep;
                pb += (pb16 & 0xFF) * fractionStep;
                pc += (pc16 & 0xFF) * fractionStep;
                pd += (pd16 & 0xFF) * fractionStep;
            }
            const rotationCenter = { x: size.x >> 1, y: size.y >> 1, };

            // Make adjustments for double sized affine sprites
            if (doubleAffineSize) {
                rotationCenter.x * 1.5;
                rotationCenter.y * 1.5;
                size.x <<= 1;
                size.y <<= 1;
            }

            // Sprite is not overlapping this scanline
            if (y < spriteY || y >= spriteY + size.y) {
                continue;
            }

            let xStart = spriteX;
            let xEnd = spriteX + size.x;

            for (let x = xStart; x < xEnd; x++) {
                // Check if pixel is off screen
                if (x < 0 || x >= DisplayConstants.hDrawPixels) {
                    continue;
                }

                // Skip pixels that do not have objects enabled for the window being drawn
                if (((scanlineControls[x] >> 4) & 0x1) === 0) {
                    continue;
                }

                // Coordinates local to the sprite, (0, 0) = sprite top left
                let localX = x - xStart - (doubleAffineSize ? size.x >> 2 : 0);
                let localY = y - spriteY - (doubleAffineSize ? size.y >> 2 : 0);

                if (affineSprite) {
                    const prevLocalX = localX;
                    const prevLocalY = localY;

                    // Apply affine transformation
                    localX = Math.floor(pa * (prevLocalX - rotationCenter.x) + pb * (prevLocalY - rotationCenter.y) + rotationCenter.x);
                    localY = Math.floor(pc * (prevLocalX - rotationCenter.x) + pd * (prevLocalY - rotationCenter.y) + rotationCenter.y);

                    // Transformed position is not within sprite bounds
                    if (localX < 0 || localX >= size.x || localY < 0 || localY >= size.y) {
                        continue;
                    }

                } else {
                    if (verticalFlip) {
                        localY = size.y - localY - 1;
                    }

                    if (horizontalFlip) {
                        localX = size.x - localX - 1;
                    }
                }

                const tileX = Math.floor(localX / SpriteConstants.tileSize);
                const tileY = Math.floor(localY / SpriteConstants.tileSize);

                // Local position is not within the bounds of the sprite
                if (tileX < 0 || tileX >= tileSize.x || tileY < 0 || tileY >= tileSize.y) {
                    continue;
                }

                // The address containing the first byte of the relevant tile's color data.
                let tileRowAddress;
                if (objDimension === 1) {
                    // 1D tile arrangement
                    tileRowAddress =
                        SpriteConstants.charBlock4Address +
                        (tileIndex + tileY * tilesPerRow + tileX) % SpriteConstants.maxVRAMTiles * bytesPerTile +
                        (localY % SpriteConstants.tileSize) * bytesPerTileRow;
                } else {
                    // 2D tile arrangement
                    tileRowAddress =
                        SpriteConstants.charBlock4Address +
                        (tileIndex + tileY * 32 + tileX) % SpriteConstants.maxVRAMTiles * bytesPerTile +
                        (localY % SpriteConstants.tileSize) * bytesPerTileRow;
                }

                let pixelColor;
                if (colorMode === 0) {
                    // 4 bit color index in 16/16 palettes
                    const tilePixelAddress = tileRowAddress + Math.floor((localX % SpriteConstants.tileSize) >> 1);
                    const pixelData = this.memory.getInt8(tilePixelAddress).value;
                    const paletteIndex = (localX % SpriteConstants.tileSize) % 2 === 0 ?
                        pixelData & 0xF :
                        (pixelData >> 4) & 0xF;
                    if (paletteIndex > 0) {
                        const colorAddress = SpriteConstants.spritePaletteAddress + (palette * SpriteConstants.spritePaletteBytes) + paletteIndex * 2;
                        pixelColor = this.get15BitColorFromAddress(colorAddress);
                    }
                } else {
                    // 8 bit color index in 256/1 palette
                    const tilePixelAddress = tileRowAddress + (localX % SpriteConstants.tileSize)
                    const paletteIndex = this.memory.getInt8(tilePixelAddress).value;
                    if (palette > 0) {
                        const colorAddress = SpriteConstants.spritePaletteAddress + paletteIndex * 2;
                        pixelColor = this.get15BitColorFromAddress(colorAddress);
                    }
                }

                if (pixelColor) {
                    this.display.setPixel(x, y, pixelColor);
                }

            }
        }
    }

    getScanlineSegments(y: number, displayControl: number) : ScanlineSegment[] {
        const window0Enabled = (displayControl >> 13) & 0x1;
        const window1Enabled = (displayControl >> 14) & 0x1;
        const windowObjEnabled = (displayControl >> 15) & 0x1;
        const windowEnabled = window0Enabled | window1Enabled | windowObjEnabled;

        if (windowEnabled) {
            const win0Horizontal = this.cpu.memory.getInt16(displayRegisters.WIN0H).value;
            const win1Horizontal = this.cpu.memory.getInt16(displayRegisters.WIN1H).value;
            const win0Vertical = this.cpu.memory.getInt16(displayRegisters.WIN0V).value;
            const win1Vertical = this.cpu.memory.getInt16(displayRegisters.WIN1V).value;
            const winIn = this.cpu.memory.getInt16(displayRegisters.WININ).value;
            const winOut = this.cpu.memory.getInt16(displayRegisters.WINOUT).value;

            const window0Edges = {
                right: Math.min(win0Horizontal & 0xFF, DisplayConstants.hDrawPixels) - 1,
                left: (win0Horizontal >> 8) & 0xFF,
                bottom: Math.min(win0Vertical & 0xFF, DisplayConstants.vDrawPixels) - 1,
                top: (win0Vertical >> 8) & 0xFF,
            };

            const window1Edges = {
                right: Math.min(win1Horizontal & 0xFF, DisplayConstants.hDrawPixels) - 1,
                left: (win1Horizontal >> 8) & 0xFF,
                bottom: Math.min(win1Vertical & 0xFF, DisplayConstants.vDrawPixels) - 1,
                top: (win1Vertical >> 8) & 0xFF,
            };

            const ranges = [];

            if (window0Enabled && window0Edges.top <= y && window0Edges.bottom >= y) {
                ranges.push({ min: window0Edges.left, max: window0Edges.right, controls: winIn & 0x3F });
            }

            if (window1Enabled && window1Edges.top <= y && window1Edges.bottom >= y) {
                ranges.push({ min: window1Edges.left, max: window1Edges.right, controls: (winIn >> 8) & 0x3F });
            }

            if (windowObjEnabled) {
                // TODO: implement OBJ window. Sprites should act as mask for other layers?
                console.warn(`OBJ window not implemented, ignoring.`);
            }

            // Full range covering the scanline for the background
            ranges.push({ min: 0, max: DisplayConstants.hDrawPixels - 1, controls: winOut & 0x3F });

            return ranges;
        } else {
            // Range that covers full screen width and enables all controls.
            return [ {min: 0, max: DisplayConstants.hDrawPixels - 1, controls: 0x3F} ];
        }
    }

    /**
     * Creates an array with an index for every x coordinate in a given scanline. The
     * value at each index is a number containing the bits controlling which backgrounds
     * and if objects are enabled for that pixel. This resolves any background/object
     * overlapping that may occur when multiple windows are enabled.
     *
     * If no windows are enabled, each index will have bits allowing for all backgrounds
     * and objects, although the logic specific to each display mode and the display control
     * registers may further restrict what gets rendered.
     */
    getScanlineControls(y: number, displayControl: number): number[] {
        const scanlineSegments = this.getScanlineSegments(y, displayControl);
        const scanlineControls = new Array(DisplayConstants.hDrawPixels).fill(scanlineSegments.length - 1);
        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            for (let i = 0; i < scanlineSegments.length; i++) {
                if (x >= scanlineSegments[i].min && x <= scanlineSegments[i].max) {
                    scanlineControls[x] = scanlineSegments[i].controls;
                    break;
                }
            }
        }

        return scanlineControls;
    }

    loadAffineBackgroundReferencePoints() {
        for (let backgroundIndex = 2; backgroundIndex <= 3; backgroundIndex++) {
            const referencePointXControl = this.memory.getInt32(displayRegisters[`BG${backgroundIndex}X` as DisplayRegister]).value >>> 0;
            const referencePointXSign = (referencePointXControl & 0x4000000) > 0 ? -1 : 1;
            const referencePointXInteger = referencePointXSign === -1 ?
                ~signExtend((referencePointXControl >> 8) & 0x7FFFF, 19) + 1 :
                (referencePointXControl >> 8) & 0x7FFFF;
            const referencePointXFraction = referencePointXControl & 0xFF;

            const referencePointYControl = this.memory.getInt32(displayRegisters[`BG${backgroundIndex}Y` as DisplayRegister]).value >>> 0;
            const referencePointYSign = (referencePointYControl & 0x4000000) > 0 ? -1 : 1;
            const referencePointYInteger = referencePointYSign === -1 ?
                ~signExtend((referencePointYControl >> 8) & 0x7FFFF, 19) + 1 :
                (referencePointYControl >> 8) & 0x7FFFF;
            const referencePointYFraction = referencePointYControl & 0xFF;

            const fractionStep = 0.00390625;
            this.affineReferencePoints[backgroundIndex] = {
                x: referencePointXSign * (referencePointXInteger + referencePointXFraction * fractionStep),
                y: referencePointYSign * (referencePointYInteger + referencePointYFraction * fractionStep),
            };
        }
    }

}


export { PPU }
export type { PPUType, PPUStepFlags }
