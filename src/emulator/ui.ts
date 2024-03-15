import { disassembleARM } from "./armDisassembler";
import { OperatingModeNames, statusRegisterFlags } from "./cpu";
import { GBA } from "./gba";
import { disassembleTHUMB } from "./thumbDisassembler";

/**
 * Functions used to connect the browser UI elements to the 
 * GBA internals.
 */

/**
 * Returns a list of content to populate the instruction table of the debugger.
 */
const getInstructionTableLines = (baseAddress: number, length: number, gba: GBA) : any[] => {
    const lines: any[] = [];
    const start = baseAddress - gba.cpu.instructionSize * (Math.floor(length / 2));
    const thumbMode = gba.cpu.operatingState === "THUMB";

    for (let i = 0; i < length; i++) {
        const address = start + i * gba.cpu.instructionSize;
        const instructionText = thumbMode ?
            disassembleTHUMB(gba.cpu, gba.cpu.memory.getInt16(address).value >>> 0, address) :
            disassembleARM(gba.cpu, gba.cpu.memory.getInt32(address).value >>> 0, address);
        const line = {
            address: address,
            instruction: (thumbMode ? gba.cpu.memory.getInt16(address).value : gba.cpu.memory.getInt32(address).value) >>> 0,
            text: instructionText
        };
        lines.push(line);
    }

    return lines;
}

const getRegisterText = (gba: GBA) => {
    const text: {[key: string]: string} = {};
    for (let i = 0; i <= 15; i++) {
        text[`r${i}`] = (gba.cpu.getGeneralRegister(i) >>> 0).toString(16).padStart(8, '0');
    }
    text["cpsr"] = (gba.cpu.getStatusRegister("CPSR") >>> 0).toString(16).padStart(8, "0");
    if (gba.cpu.currentModeHasSPSR()) {
        text["spsr"] = (gba.cpu.getStatusRegister("SPSR") >>> 0).toString(16).padStart(8, "0");
    } else {
        text["spsr"] = `no spsr in ${OperatingModeNames[gba.cpu.operatingMode]} mode`;
    }

    statusRegisterFlags.forEach(flag => {
        text[`flag_${flag}`] = gba.cpu.getStatusRegisterFlag("CPSR", flag) === 0 ? "false" : "true";
    });
    return text;
}

const getFrameInfo = (gba: GBA) => {
    let fps = 0, frameTime = 0, cycles = 0;

    if (gba.status === 'running') {
        frameTime = gba.frameQueue.reduce((a, b) => a + b, 0) / gba.frameQueue.length;
        fps = 1000 / frameTime;
        cycles = gba.cpu.cycles;
    }

    return { fps, frameTime, cycles };
}

const getPaletteColors = (gba: GBA) => {
    const bytesPerColor = 2;

    const bgPalette: string[] = [];
    const bgPaletteStartAddress = 0x05000000;
    for (let i = 0; i < 16 * 16; i++) {
        const color = get15BitColorFromAddress(gba, bgPaletteStartAddress + i * bytesPerColor);
        bgPalette.push(
            `rgb(` +
            `${Math.floor(color.red)}, ` +
            `${Math.floor(color.green)}, ` +
            `${Math.floor(color.blue)}` +
            `)`
        );
    }

    const spritePalette: string[] = [];
    const spritePaletteStartAddress = 0x05000200;
    for (let i = 0; i < 16 * 16; i++) {
        const color = get15BitColorFromAddress(gba, spritePaletteStartAddress + i * bytesPerColor);
        spritePalette.push(
            `rgb(` +
            `${Math.floor(color.red)}, ` +
            `${Math.floor(color.green)}, ` +
            `${Math.floor(color.blue)}` +
            `)`
        );
    }

    return { bgPalette, spritePalette };
}

const getTiles = (gba: GBA, charblockIndex: number, paletteMode16: boolean, paletteIndex: number) => {
    const bgPaletteStartAddress = charblockIndex < 4 ? 0x05000000 : 0x05000200;
    const vramStartAddress = 0x06000000;
    const charblockSize = 0x4000;
    const tilesPerCharblock = paletteMode16 ? 512 : 256;
    const bytesPerTile = paletteMode16 ? 32 : 64;
    const bytesPerPalette = 32;

    const tiles: any[] = [];
    for (let tileIndex = 0; tileIndex < tilesPerCharblock; tileIndex++) {
        const tileAddress = vramStartAddress + charblockIndex * charblockSize;
        const tileBytes = gba.memory.getBytes(tileAddress + tileIndex * bytesPerTile, bytesPerTile);
        const tile: any[] = [];
        for (let i = 0; i < 64; i++) {
            if (paletteMode16) {
                const colorIndex = i % 2 === 0 ?
                    tileBytes[i / 2] & 0xF :
                    (tileBytes[Math.floor(i / 2)] >> 4) & 0xF;
                const color = get15BitColorFromAddress(gba, bgPaletteStartAddress + paletteIndex * bytesPerPalette + colorIndex * 2);
                tile.push(color);
            } else {
                const colorIndex = tileBytes[i] & 0xFF;
                const color = get15BitColorFromAddress(gba, bgPaletteStartAddress + colorIndex * 2);
                tile.push(color);
            }
        }
        tiles.push(tile); 
    }

    return tiles;
}

const getDisplayControl = (gba: GBA) => {
    const displayControlAddress = 0x04000000;
    const displayControl = gba.memory.getInt16(displayControlAddress).value;

    let backgrounds = "";
    for (let i = 8; i <= 11; i++) {
        if (((displayControl >> i) & 0x1) === 1) {
            if (backgrounds.length > 0) backgrounds += ", ";
            backgrounds += `${i - 8}`;
        }
    }

    return {
        displayMode: displayControl & 0x7,
        frameSelect: (displayControl >> 4) & 0x1,
        hblankIntervalFree: (displayControl >> 5) & 0x1,
        objVRAMMapping: ((displayControl >> 6) & 0x1) === 1 ? "1d" : "2d",
        forcedBlank: (displayControl >> 7) & 0x1,
        enabledBackgrounds: backgrounds,
        displayObj: ((displayControl >> 12) & 0x1) === 1 ? "On" : "Off",
    };
}

const get15BitColorFromAddress = (gba: GBA, address: number) : any => {
    const colorData = gba.memory.getInt16(address).value;
    return {
        red: 255 * ((colorData >>> 0) & 0x1F) / 32,
        green: 255 * ((colorData >>> 5) & 0x1F) / 32,
        blue: 255 * ((colorData >>> 10) & 0x1F) / 32,
    };
}

const UI = {
    getInstructionTableLines,
    getRegisterText,
    getFrameInfo,
    getPaletteColors,
    getTiles,
    getDisplayControl,
};

export { UI }
