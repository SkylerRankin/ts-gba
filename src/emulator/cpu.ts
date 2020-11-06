import { assembleInstruction } from './assembler';

/**
 * A simulator for a CPU that implements the ARM ISA.
 * This includes 32 bit instructions, 31 general use registers, 6 status registers.
 */

interface CPUType {
    rom: number[],
    generalRegisters: number[],
    statusRegisters: number[]
}

// Keys for the named registers.
const Reg = {
    SP: 13, // Stack Pointer
    LR: 14, // Link Register, holds subroutine return address during BL and BLX
    PC: 15  // Program Counter
}

class CPU implements CPUType {
    rom = [] as number[];
    generalRegisters = [] as number[];
    statusRegisters = [] as number[];

    constructor() {}

    loadProgramFromText(program: string[]) : void {
        this.rom = [];
        program.forEach((instruction: string) => {
            const i = assembleInstruction(instruction);
            console.log(`${instruction}    ${i}: ${i.toString(2)}`);
            this.rom.push(i);
        });
    }

    loadProgram(program: number[]) : void {
        this.rom = program;
    }

}

export { CPU }
export type { CPUType }
