import { processARM, ProcessedInstructionOptions } from './armInstructionProcessors';
import { processTHUMB } from './thumbInstructionProcessors';
import { Memory } from './memory';
import { StateHistory } from './stateHistory';
import { byteArrayToInt32 } from './math';

/**
 * A simulator for a CPU that implements the ARM ISA.
 * This includes 32 bit instructions, 31 general use registers, 6 status registers.
 */

type CPUType = {
    memory: Memory,
    generalRegisters: number[][],
    statusRegisters: number[][],
    operatingMode: number,
    operatingState: OperatingState,
    history: StateHistory,
    bigEndian: boolean,
    reset: () => void,
    step: () => void,
    atBreakpoint: () => boolean,
    
    updateStatusRegister: (update: StatusRegisterUpdate) => void,
    getStatusRegisterFlag(flag: StatusRegisterKey) : number,
    setStatusRegisterFlag(flag: StatusRegisterKey, value: number) : void,
    getStatusRegister: (reg: StatusRegister) => number,

    setGeneralRegister: (reg: number, value: number) => void,
    setGeneralRegisterByMode(reg: number, value: number, mode: OperatingMode) : void,
    getGeneralRegister: (reg: number) => number,
    getGeneralRegisterByMode: (reg: number, mode: OperatingMode) => number,

    getBytesFromMemory(address: number, bytes: number) : Uint8Array,
    setBytesInMemory(address: number, bytes: Uint8Array) : void,
}

const OperatingModeCodes = {
    'usr': 0b10000,
    'fiq': 0b10001,
    'irq': 0b10010,
    'svc': 0b10011,
    'abt': 0b10111,
    'sys': 0b11011,
    'und': 0b11111
};
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

/**
 * Status register flag values:
 * t = 0 for ARM, 1 for Thumb
 */
type StatusRegister = 'CPSR' | 'SPSR';
type StatusRegisterKey = 'n' | 'z' | 'c' | 'v' | 'q' | 'i' | 'f' | 't';
type StatusRegisterUpdate = StatusRegisterKey[];

class CPU implements CPUType {
    memory = new Memory();
    generalRegisters = [] as number[][];
    statusRegisters = [] as number[][];
    operatingMode = 0;
    operatingState = 'ARM' as OperatingState;
    history = new StateHistory();
    bigEndian = false;

    constructor() {
        for (let i = 0; i < 7; i++) {
            this.generalRegisters.push(new Array<number>(16).fill(0));
            this.statusRegisters.push(new Array<number>(2).fill(0));
        }
        this.statusRegisters[0][0] = (0b1011 << 28 >>> 0) || 0b11011;
    }

    loadProgram(program: number[]) : void {
        this.memory.loadROM(program);
    }

    atBreakpoint() : boolean {
        // For testing, stop when the instruction is nop
        return false;
        // return this.rom[this.generalRegisters[this.operatingMode][Reg.PC]] == 0 || this.rom[this.generalRegisters[Reg.PC]] == undefined;
    }

    step() : void {
        this.history.startLog();
        this.history.logCPU(this);

        const pc = this.getGeneralRegister(Reg.PC);
        const instructionSize = this.operatingState === 'ARM' ? 4 : 2;
        // PC points to the instruction after the next instruction, so we subtract 8 bytes.
        const instruction = byteArrayToInt32(this.memory.getBytes(pc - 8, instructionSize), this.bigEndian);
        const condition = instruction >> 27;
        let options: ProcessedInstructionOptions | undefined;
        if (this.conditionIsMet(condition)) {
            options = this.operatingState === 'ARM' ?
                processARM(this, instruction) :
                processTHUMB(this, instruction);
        }

        if (!options) return;
        if (options.incrementPC) this.setGeneralRegister(Reg.PC, pc + instructionSize);

        this.history.endLog();
    }

    /**
     * Clears out all registers and memory. Sets CPU to ARM user mode.
     */
    reset() : void {
        this.memory.reset();
        this.history.reset();
        this.generalRegisters.fill(new Array<number>(16).fill(0), 0, this.generalRegisters.length);
        this.statusRegisters.fill(new Array<number>(2).fill(0), 0, this.generalRegisters.length);
        this.operatingState = 'ARM';
        this.bigEndian = false;
        this.setModeBits(OperatingModeCodes.usr);
        this.setStateBit(0);
        this.setGeneralRegister(Reg.PC, 0x08000008);
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

    getConditionCodeFlag(flag: 'n' | 'z' | 'c' | 'v') : number {
        let cpsr = this.getStatusRegister('CPSR');
        switch (flag) {
            case 'n': return (cpsr >>> 31) & 0x1;
            case 'z': return (cpsr >>> 30) & 0x1;
            case 'c': return (cpsr >>> 29) & 0x1;
            case 'v': return (cpsr >>> 28) & 0x1;
        }
    }

    getStatusRegisterFlag(flag: StatusRegisterKey) : number {
        let cpsr = this.getStatusRegister('CPSR');
        switch (flag) {
            case 'n': return (cpsr >>> 31) & 0x1;
            case 'z': return (cpsr >>> 30) & 0x1;
            case 'c': return (cpsr >>> 29) & 0x1;
            case 'v': return (cpsr >>> 28) & 0x1;
            case 'q': return (cpsr >>> 27) & 0x1;
            case 'i': return (cpsr >>> 7) & 0x1;
            case 'f': return (cpsr >>> 6) & 0x1;
            case 't': return (cpsr >>> 5) & 0x1;
        }
    }

    setStatusRegisterFlag(flag: StatusRegisterKey, value: number) : void {
        let cpsr = this.getStatusRegister('CPSR');
        switch (flag) {
            case 'n': cpsr &= (value << 31); break;
            case 'z': cpsr &= (value << 30); break;
            case 'c': cpsr &= (value << 29); break;
            case 'v': cpsr &= (value << 28); break;
            case 'q': cpsr &= (value << 27); break;
            case 'i': cpsr &= (value << 7); break;
            case 'f': cpsr &= (value << 6); break;
            case 't':
                cpsr &= (value << 5);
                this.operatingState = value === 0 ? 'ARM' : 'THUMB';
                break;
        }
        this.statusRegisters[0][0] = cpsr;
    }

    setModeBits(value: number) : void {
        if (Object.values(OperatingModeCodes).includes(value)) {
            this.statusRegisters[0][0] &= ~0x1F;
            this.statusRegisters[0][0] |= value;
            this.operatingMode = Object.values(OperatingModeCodes).indexOf(value);
        } else {
            throw `Invalid mode bits ${value.toString(2)}`;
        }
    }

    cpsrToSPSR() : void {
        if (this.operatingMode === 0 || this.operatingMode === 5) {
            // No SPSR in User or System mode, so nothing to copy.
        } else {
            this.statusRegisters[0][0] = this.statusRegisters[this.operatingMode][1];
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

    setGeneralRegister(reg: number, value: number): void {
        if (BankedRegisters[this.operatingState][this.operatingMode].includes(reg)) {
            this.generalRegisters[this.operatingMode][reg] = value;
        } else {
            this.generalRegisters[0][reg] = value;
        }
    }

    setGeneralRegisterByMode(reg: number, value: number, mode: OperatingMode) : void {
        this.generalRegisters[OperatingModeNames.indexOf(mode)][reg] = value;
    }

    getGeneralRegister(reg: number): number {
        if (BankedRegisters[this.operatingState][this.operatingMode].includes(reg)) {
            return this.generalRegisters[this.operatingMode][reg];
        } else {
            return this.generalRegisters[0][reg];
        }
    }

    getGeneralRegisterByMode(reg: number, mode: OperatingMode) : number {
        return this.generalRegisters[OperatingModeNames.indexOf(mode)][reg];
    }

    getStateString() : string {
        const modeBits = this.getStatusRegister('CPSR') & 0x1F;
        const modeName = Object.values(OperatingModeCodes).includes(modeBits) ?
            OperatingModeNames[Object.values(OperatingModeCodes).indexOf(modeBits)].toUpperCase() :
            'ERR';
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

    getBytesFromMemory(address: number, bytes: number) : Uint8Array {
        return this.memory.getBytes(address, bytes);
    }

    setBytesInMemory(address: number, bytes: Uint8Array) : void {
        this.memory.setBytes(address, bytes);
    }

}

export { CPU, OperatingModeCodes, Reg }
export type { CPUType, StatusRegisterUpdate, OperatingMode, OperatingState }
