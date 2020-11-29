import { assembleInstruction } from './assembler';
import { process } from './instructionProcessors';

/**
 * A simulator for a CPU that implements the ARM ISA.
 * This includes 32 bit instructions, 31 general use registers, 6 status registers.
 */

type CPUType = {
    rom: number[],
    generalRegisters: number[][],
    statusRegisters: number[][],
    operatingMode: number,
    operatingState: OperatingState,
    loadProgramFromText: (program: string[]) => void,
    reset: () => void,
    step: () => void,
    atBreakpoint: () => boolean,
    updateStatusRegister: (update: StatusRegisterUpdate) => void
    getStatusRegister: (reg: StatusRegister) => number,
    updateGeneralRegister: (reg: number, value: number) => void
    getGeneralRegister: (reg: number) => number
}

// Operating Modes; an index 0-6 stores the current mode
const OperatingModeCodes = [0b10000, 0b10001, 0b10010, 0b10011, 0b10111, 0b11011, 0b11111];
const OperatingModeNames = ['usr', 'fiq', 'irq', 'svc', 'abt', 'sys', 'und'];
type OperatingMode = 'usr' | 'fiq' | 'irq' | 'svc' | 'abt' | 'sys' | 'und';
// CPSR[5] = 1 for Thumb, 0 for ARM
type OperatingState = 'ARM' | 'THUMB';

// Indices for the named registers.
const Reg = {
    SP: 13, // R13, Stack Pointer
    LR: 14, // R14, Link Register, holds subroutine return address during branch.
    PC: 15  // R15, Program Counter
}

/** 
 * Lists of the banked registers for each mode for each state. Banked registers
 * have their own register value in each state. Non-banked registers share the
 * same physical register. This means banked register values would be saved
 * when operating mode changes and non-banked register values can be
 * overwritten.
 */
const BankedRegisters = {
    'ARM': [
        [], // User
        [8, 9, 10, 11, 12, Reg.SP, Reg.LR], // FIQ
        [Reg.SP, Reg.LR], // IRQ
        [Reg.SP, Reg.LR], // SVC
        [Reg.SP, Reg.LR], // ABT
        [], // SYS
        [Reg.SP, Reg.LR] // UND
    ],
    'THUMB': [
        [], // User
        [Reg.SP, Reg.LR], // FIQ
        [Reg.SP, Reg.LR], // IRQ
        [Reg.SP, Reg.LR], // SVC
        [Reg.SP, Reg.LR], // ABT
        [], // SYS
        [Reg.SP, Reg.LR] // UND
    ]
};

type StatusRegister = 'CPSR' | 'SPSR';
type StatusRegisterKey = 'n' | 'z' | 'c' | 'v' | 'q' | 'i' | 'f' | 't';
type StatusRegisterUpdate = StatusRegisterKey[];

class CPU implements CPUType {
    rom = [] as number[];
    generalRegisters = [] as number[][];
    statusRegisters = [] as number[][];
    operatingMode = 0;
    operatingState = 'ARM' as OperatingState;

    constructor() {
        for (let i = 0; i < 7; i++) {
            this.generalRegisters.push(new Array<number>(16).fill(0));
            this.statusRegisters.push(new Array<number>(2).fill(0));
        }
        this.statusRegisters[0][0] = (0b1011 << 28 >>> 0) || 0b11011;
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
        return false;
        // return this.rom[this.generalRegisters[this.operatingMode][Reg.PC]] == 0 || this.rom[this.generalRegisters[Reg.PC]] == undefined;
    }

    step() : void {
        const pc = this.getGeneralRegister(Reg.PC);
        // PC points to the instruction after the next instruction, so we subtract 8 bytes.
        let instruction = 0;
        for (let i = 0; i < 4; i++) {
            instruction += this.rom[pc - 8 + i] << ((3 - i) * 8);
        }
        const condition = instruction >> 27;
        if (this.conditionIsMet(condition)) {
            process(this, instruction);
        }

        if (this.operatingState === 'ARM') this.updateGeneralRegister(Reg.PC, pc + 4);
        else this.updateGeneralRegister(Reg.PC, pc + 2);
    }

    /**
     * Clears out all registers and memory. Sets CPU to ARM user mode.
     */
    reset() : void {
        this.rom = [];
        this.generalRegisters.fill(new Array<number>(16).fill(0), 0, this.generalRegisters.length);
        this.statusRegisters.fill(new Array<number>(2).fill(0), 0, this.generalRegisters.length);
        this.setModeBits(OperatingModeCodes[0]);
        this.setStateBit(0);
        this.updateGeneralRegister(Reg.PC, 8);
    }

    conditionIsMet(condition: number) : boolean {
        return true;
    }

    clearConditionCodeFlags() : void {
        this.statusRegisters[0][0] &= ~0xF0000000;
    }

    setConditionCodeFlags(...flags: ('n' | 'z' | 'c' | 'v')[]) : void {
        let cpsr = this.getStatusRegister('CPSR');
        const setMasks : number[] = [0x80000000, 0x40000000, 0x20000000, 0x10000000];
        ['n', 'z', 'c', 'v'].forEach((key: any, i: number) => {
            if (flags.includes(key)) cpsr |= setMasks[i];
        });
        this.statusRegisters[0][0] = cpsr;
    }

    setModeBits(value: number) : void {
        if (OperatingModeCodes.includes(value)) {
            this.statusRegisters[0][0] &= ~0x1F;
            this.statusRegisters[0][0] |= value;
            this.operatingMode = OperatingModeCodes.indexOf(value);
        } else {
            throw `Invalid mode bits ${value.toString(2)}`;
        }
    }

    /**
     * The T bit of the CPSR is 0 for ARM state, 1 for THUMB state.
     */
    setStateBit(value: number) : void {
        if (value) this.statusRegisters[0][0] |= 0x20;
        else this.statusRegisters[0][0] &= ~0x20;
        this.operatingState = value ? 'THUMB' : 'ARM';
    }

    updateStatusRegister(update: StatusRegisterUpdate) : void {
        const keys : StatusRegisterKey[] = ['n', 'z', 'c', 'v', 'q', 'i', 'f', 't'];
        const setMasks : number[] = [0x80000000, 0x40000000, 0x20000000, 0x10000000, 0x8000000, 0x80, 0x40, 0x20];
        const clearMasks : number[] = setMasks.map((mask: number) => ~mask);
        let newStatus = this.statusRegisters[0][0];

        keys.forEach((key: StatusRegisterKey, i: number) => {
            if (update.includes(key)) newStatus |= setMasks[i];
            else newStatus &= clearMasks[i];
        });

        this.statusRegisters[0][0] = newStatus;
    }

    /**
     * There are two status registers, CPSR (Current Program Status Register)
     * and SPSR (Saved Program Status Register). CPSR is the same for all
     * operating modes, and SPSR is banked for all operating modes with the
     * exception of System and User modes, where it is not accessible. Both
     * ARM and THUMB state have this status register setup.
     */
    getStatusRegister(reg: StatusRegister): number {
        if (reg === 'SPSR' && (this.operatingMode == 0 || this.operatingMode === 5)) {
            throw `Cannot access SPSR in operating mode ${this.operatingMode}.`;
        }
        switch (reg) {
            case 'CPSR': return this.statusRegisters[0][0];
            case 'SPSR': return this.statusRegisters[this.operatingMode][1];
        }
    }

    updateGeneralRegister(reg: number, value: number): void {
        if (BankedRegisters[this.operatingState][this.operatingMode].includes(reg)) {
            this.generalRegisters[this.operatingMode][reg] = value;
        } else {
            this.generalRegisters[0][reg] = value;
        }
    }

    getGeneralRegister(reg: number): number {
        if (BankedRegisters[this.operatingState][this.operatingMode].includes(reg)) {
            return this.generalRegisters[this.operatingMode][reg];
        } else {
            return this.generalRegisters[0][reg];
        }
    }

    getStateString() : string {
        const modeBits = this.getStatusRegister('CPSR') & 0x1F;
        const modeName = OperatingModeNames[OperatingModeCodes.indexOf(modeBits)].toUpperCase() || 'ERR';
        const state = (this.getStatusRegister('CPSR') & 0x20) === 0 ? 'ARM' : 'THB';
        let registers = '';
        if (this.operatingState === 'ARM') {
            for (let i = 0; i < 16; i++) {
                registers += (i === 0 ? '' : ', ') + (this.getGeneralRegister(i) >>> 0).toString(16).padStart(8, '0');
            }
        } else {
            registers = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 15].reduce(
                (acc, value, i) => acc + (i > 0 ? ', ' : '') + (this.getGeneralRegister(value) >>> 0).toString(16).padStart(8, '0'), '');
        }
        const cpsr = this.getStatusRegister('CPSR');
        const nzcv = (cpsr >>> 0).toString(2).padStart(32, '0').slice(0, 4);
        return `${state} ${modeName} NZCV:[${nzcv}] Reg:[${registers}]`;
    }

}

export { CPU, OperatingModeCodes, Reg }
export type { CPUType, StatusRegisterUpdate, OperatingMode, OperatingState }
