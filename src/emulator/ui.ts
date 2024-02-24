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
    const start = baseAddress- gba.cpu.instructionSize * (Math.floor(length / 2));

    for (let i = 0; i < length; i++) {
        const address = start + i * gba.cpu.instructionSize;
        const instructionText = gba.cpu.operatingState === 'ARM' ?
            "?????" :
            disassembleTHUMB(gba.cpu, gba.cpu.memory.getInt16(address));
        const line = {
            address: address,
            instruction: gba.cpu.memory.getInt16(address),
            text: instructionText
        };
        lines.push(line);
    }

    return lines;
}

const UI = {
    getInstructionTableLines
};

export { UI }
