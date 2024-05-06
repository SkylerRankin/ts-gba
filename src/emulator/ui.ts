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

const getMemoryBytes = (gba: GBA, startAddress: number) : any => {
    let rows = [];
    startAddress &= 0xFFFFFFF0;
    for (let i = 0; i < 10; i++) {
        const bytes = [];
        for (let j = 0; j < 16; j++) {
            bytes.push(gba.memory.getInt8(startAddress + i * 16 + j).value);
        }
        rows.push({
            address: startAddress + i * 16,
            bytes,
        });
    }
    return rows;
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
    let fps = 0, frameTime = 0, cycles = 0, steps = 0;

    if (gba.status === 'running') {
        frameTime = gba.frameQueue.reduce((a, b) => a + b, 0) / gba.frameQueue.length;
        fps = 1000 / frameTime;
        cycles = gba.cyclesQueue.reduce((a, b) => a + b, 0) / gba.cyclesQueue.length;
        steps = gba.stepsQueue.reduce((a, b) => a + b, 0) / gba.stepsQueue.length;
    }

    return { fps, frameTime, cycles, steps };
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

const getInterruptInfo = (gba: GBA) => {
    const imeAddress = 0x04000208;
    const ieAdderss = 0x04000200;
    const ifAddress = 0x4000202;
    const checkFlagAddresses = [ 0x03007FF8, 0x03FFFFF8 ];
    const ime = gba.memory.getInt16(imeAddress).value;
    const ie = gba.memory.getInt16(ieAdderss).value;
    const ifValue = gba.memory.getInt16(ifAddress).value;
    const cpsrIFlag = gba.cpu.getStatusRegisterFlag("CPSR", "i");

    let checkFlagValue0 = gba.memory.getInt16(checkFlagAddresses[0]).value;
    let checkFlagValue1 = gba.memory.getInt16(checkFlagAddresses[1]).value;
    let checkFlag;
    if (checkFlagValue0 === checkFlagValue1) {
        checkFlag = checkFlagValue0.toString(16).padStart(8, '0');
    } else {
        checkFlag = `! ${checkFlagValue0.toString(16).padStart(8, '0')} / ${checkFlagValue1.toString(16).padStart(8, '0')}`;
    }

    return {
        values: {
            imeValue: ime.toString(16).padStart(8, '0'),
            ieValue: ie.toString(16).padStart(8, '0'),
            ifValue: ifValue.toString(16).padStart(8, '0'),
            checkFlag: checkFlag,
        },
        flags: {
            cpsr: cpsrIFlag === 0,
            ime: (ime & 0x1) === 1,
            vBlank: ((ie >> 0) & 0x1) === 1,
            hBlank: ((ie >> 1) & 0x1) === 1,
            vBlankCount: ((ie >> 2) & 0x1) === 1,
            timer0: ((ie >> 3) & 0x1) === 1,
            timer1: ((ie >> 4) & 0x1) === 1,
            timer2: ((ie >> 5) & 0x1) === 1,
            timer3: ((ie >> 6) & 0x1) === 1,
            serial: ((ie >> 7) & 0x1) === 1,
            dma0: ((ie >> 8) & 0x1) === 1,
            dma1: ((ie >> 9) & 0x1) === 1,
            dma2: ((ie >> 10) & 0x1) === 1,
            dma3: ((ie >> 11) & 0x1) === 1,
            keypad: ((ie >> 12) & 0x1) === 1,
            gamePak: ((ie >> 13) & 0x1) === 1,
        }
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
    getMemoryBytes,
    getRegisterText,
    getFrameInfo,
    getPaletteColors,
    getTiles,
    getDisplayControl,
    getInterruptInfo,
};

export { UI }
