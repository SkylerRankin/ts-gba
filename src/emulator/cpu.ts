import { assembleInstruction } from './assembler';
import { process } from './instructionProcessors';

/**
 * A simulator for a CPU that implements the ARM ISA.
 * This includes 32 bit instructions, 31 general use registers, 6 status registers.
 */

type CPUType = {
    rom: number[],
    generalRegisters: number[],
    statusRegisters: number[],
    loadProgramFromText: (program: string[]) => void,
    reset: () => void,
    step: () => void,
    atBreakpoint: () => boolean,
    updateStatusRegister: (update: StatusRegisterUpdate) => void
}

type StatusRegisterUpdate = {
    n?: boolean,
    z?: boolean,
    c?: boolean,
    v?: boolean,
    q?: boolean,
    i?: boolean,
    f?: boolean,
    t?: boolean
}

// Keys for the named registers.
const Reg = {
    SP: 13 - 1, // R13, Stack Pointer
    LR: 14 - 1, // R14, Link Register, holds subroutine return address during BL and BLX
    PC: 15 - 1  // R15, Program Counter
}

class CPU implements CPUType {
    rom = [] as number[];
    generalRegisters = [] as number[];
    statusRegisters = [] as number[];

    constructor() {
        for (let i = 0; i < 15; i++) this.generalRegisters.push(0);
    }

    loadProgramFromText(program: string[]) : void {
        this.rom = [];
        let address = 0;
        program.forEach((instruction: string) => {
            try {
                this.rom[address] = assembleInstruction(instruction);
                address++;
            } catch (e) {
                console.log(e);
            }
        });
    }

    loadProgram(program: number[]) : void {
        this.rom = program;
    }

    atBreakpoint() : boolean {
        // For testing, stop when the instruction is nop
        return this.rom[this.generalRegisters[Reg.PC]] == 0 || this.rom[this.generalRegisters[Reg.PC]] == undefined;
    }

    step() : void {
        const instruction = this.rom[this.generalRegisters[Reg.PC]];
        const condition = instruction >> 27;
        if (this.conditionIsMet(condition)) {
            process(this, instruction);
        }
        this.generalRegisters[Reg.PC]++;
    }

    reset() : void {
        this.generalRegisters.fill(0, 0, this.generalRegisters.length);
    }

    conditionIsMet(condition: number) : boolean {
        return true;
    }

    updateStatusRegister(update: StatusRegisterUpdate) : void {
        const keys : (keyof StatusRegisterUpdate)[] = ['n', 'z', 'c', 'v', 'q', 'i', 'f', 't'];
        const setMasks : number[] = [0x80000000, 0x40000000, 0x20000000, 0x10000000, 0x8000000, 0x80, 0x40, 0x20];
        const clearMasks : number[] = setMasks.map((mask: number) => ~mask);
        let newStatus = this.statusRegisters[0];

        keys.forEach((key: keyof StatusRegisterUpdate, i: number) => {
            if (update[key]) newStatus |= setMasks[i];
            else newStatus &= clearMasks[i];
        });

        this.statusRegisters[0] = newStatus;
    }

}

export { CPU }
export type { CPUType, StatusRegisterUpdate }
