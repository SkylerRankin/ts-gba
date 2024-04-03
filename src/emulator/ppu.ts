import { CPU } from "./cpu";
import { Display, RGBColor } from "./display";
import { requestInterrupt } from "./interrupt";
import { byteArrayToInt32, signExtend } from "./math";
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
    'BG3VOFS'       // Background 3 Vertical Offset
;

type DisplayState = 'hDraw' | 'hBlank' | 'vBlank';

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
};

const BackgroundMapScreenSizes = {
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
};

const SpriteConstants = {
    maxObjectAttributes: 128,
    maxAffineAttributes: 32,
    objectAttributeSize: 8,
    affineObjectAttritubeSize: 32,
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

        const dispStat = this.cpu.memory.getInt16(displayRegisters.DISPSTAT).value;
        const vBlankIrqEnabled = (dispStat & 0x8) > 0;
        const hBlankIrqEnabled = (dispStat & 0x10) > 0;
        const vCounterIrqEnabled = (dispStat & 0x20) > 0;
        const vCountSetting = (dispStat >> 8) & 0xFF;

        switch (this.displayState) {
            case 'hDraw': {
                // V Draw completed
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
                console.log('Display mode 1 not implemented.');
                break;
            case 0x2:
                console.log('Display mode 2 not implemented.');
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
        this.fillBackgroundColor(y);

        // Render backgrounds
        for (let backgroundIndex = 0; backgroundIndex < 4; backgroundIndex++) {
            if (((displayControl >> (backgroundIndex + 8)) & 0x1) === 1) {
                this.renderTiledBackgroundScanline(y, displayControl, backgroundIndex);
            }
        }

        // Render sprites
        this.renderSpritesScanline(y, displayControl);
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

    renderTiledBackgroundScanline(y: number, displayControl: number, backgroundIndex: number) {
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
        const screenSizeMode = (backgroundControl >> 14) & 0x3;
        const screenSize = BackgroundMapScreenSizes.TEXT[screenSizeMode];

        const scrolling = {
            x: this.memory.getInt16(displayRegisters[`BG${backgroundIndex}HOFS` as DisplayRegister]).value & 0x1FF,
            y: this.memory.getInt16(displayRegisters[`BG${backgroundIndex}VOFS` as DisplayRegister]).value & 0x1FF,
        };

        const charBlockStart = MemorySegments.VRAM.start + BackgroundConstants.charBlockBytes * characterBaseBlock;
        const screenBlockBaseStart = MemorySegments.VRAM.start + BackgroundConstants.screenBlockBytes * screenBaseBlock;

        const adjustedY = (y + scrolling.y) % screenSize.y;
        const tileY = Math.floor(adjustedY / BackgroundConstants.tilePixelSize) % BackgroundConstants.screenBlockTileSize;
        const yTileOffset = adjustedY % BackgroundConstants.tilePixelSize;

        for (let x = 0; x < DisplayConstants.hDrawPixels; x++) {
            const adjustedX = (x + scrolling.x) % screenSize.x;
            const tileX = Math.floor(adjustedX / BackgroundConstants.tilePixelSize) % BackgroundConstants.screenBlockTileSize;
            const xTileOffset = adjustedX % BackgroundConstants.tilePixelSize;

            // Determine which screen block contains this pixel.
            // TODO: refactor this to remove branches, can probably achieve the same thing with division/floor.
            let screenBlockOffset = 0;
            switch (screenSizeMode) {
                case 0x0:
                    // 32x32 tiles, 1 screen block
                    screenBlockOffset = 0;
                    break;
                case 0x1:
                    // 64x32, 2 screen blocks in horizontal arrangement
                    screenBlockOffset = (adjustedX < screenSize.x / 2) ? 0 : 1;
                    break;
                case 0x2:
                    // 32x64, 2 screen blocks in vertical arrangement
                    screenBlockOffset = (adjustedY < screenSize.y / 2) ? 0 : 1;
                    break;
                case 0x3:
                    // 64x64, 4 screen blocks in clockwise square arrangement
                    if (adjustedX < screenSize.x / 2) {
                        screenBlockOffset = (adjustedY < screenSize.y / 2) ? 0 : 2;
                    } else {
                        screenBlockOffset = (adjustedY < screenSize.y / 2) ? 1 : 3;
                    }
                    break;
            }
            const screenBlockStart = screenBlockBaseStart + BackgroundConstants.screenBlockBytes * screenBlockOffset;

            // Find and decompose the screen entry. It occupies 2 bytes.
            const screenEntry = this.memory.getInt16(screenBlockStart + 2 * (tileY * 32 + tileX)).value;
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

    renderSpritesScanline(y: number, displayControl: number) {
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
                const pa16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttritubeSize + 6).value;
                const pb16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttritubeSize + 14).value;
                const pc16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttritubeSize + 22).value;
                const pd16 = this.memory.getInt16(MemorySegments.OAM.start + affineIndex * SpriteConstants.affineObjectAttritubeSize + 30).value;

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
                if (x < 0 || x >= DisplayConstants.hDrawPixels) {
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

}


export { PPU }
export type { PPUType }
