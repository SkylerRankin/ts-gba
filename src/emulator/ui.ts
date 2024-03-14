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

const UI = {
    getInstructionTableLines,
    getRegisterText,
    getFrameInfo
};

export { UI }
