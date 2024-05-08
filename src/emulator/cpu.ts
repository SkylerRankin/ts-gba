import { processARM, ProcessedInstructionOptions } from './armInstructionProcessors';
import { processTHUMB } from './thumbInstructionProcessors';
import { Memory } from './memory';
import { StateHistory } from './stateHistory';
import { CPUProfiler } from './cpuProfiler';
import { handleInterrupts } from './interrupt';

/**
 * A simulator for a CPU that implements the ARMv4T ISA.
 * This includes 32 bit instructions, 31 general use registers, 6 status registers.
 */

type CPUType = {
    memory: Memory,
    cycles: number,
    currentGeneralRegisters: number[],
    generalRegisters: number[][],
    currentStatusRegisters: number[],
    statusRegisters: number[][],
    operatingMode: number,
    operatingState: OperatingState,
    history: StateHistory,
    profiler: CPUProfiler,
    bigEndian: boolean,
    historyEnabled: boolean,
    breakpoints: Set<number>,
    
    reset: () => void,
    step: () => void,
    atBreakpoint: () => boolean,
    
    getStatusRegisterFlag(register: StatusRegister, flag: StatusRegisterKey) : number,
    setStatusRegisterFlag(flag: StatusRegisterKey, value: number) : void,
    getStatusRegister: (reg: StatusRegister) => number,

    setGeneralRegister: (reg: number, value: number) => void,
    getGeneralRegister: (reg: number) => number,
    getGeneralRegisterByMode: (reg: number, mode: number) => number,
}

const OperatingModeCodes = {
    'usr': 0b10000,
    'fiq': 0b10001,
    'irq': 0b10010,
    'svc': 0b10011,
    'abt': 0b10111,
    'und': 0b11011,
    'sys': 0b11111
};
const OperatingModeCodeToIndex = [0, 1, 2, 3, -1, -1, -1, 4, -1, -1, -1, 5, -1, -1, -1, 6];
const OperatingModes = {
    'usr': 0,
    'fiq': 1,
    'irq': 2,
    'svc': 3,
    'abt': 4,
    'und': 5,
    'sys': 6
};
const OperatingModeNames = ['usr', 'fiq', 'irq', 'svc', 'abt', 'und', 'sys'];
// type OperatingMode = 'usr' | 'fiq' | 'irq' | 'svc' | 'abt' | 'und' | 'sys';
// CPSR[5] = 1 for Thumb, 0 for ARM
type OperatingState = 'ARM' | 'THUMB';

// Indices for the named registers.
const Reg = {
    SP: 13, // R13, Stack Pointer
    LR: 14, // R14, Link Register, holds subroutine return address during branch.
    PC: 15  // R15, Program Counter
}

const cpsrBitOffsetMapping: {[key in StatusRegisterKey]: number} = {
    'n': 31,
    'z': 30,
    'c': 29,
    'v': 28,
    // 'q': 27,
    'i': 7,
    'f': 6,
    't': 5
};

const statusRegisterFlags: StatusRegisterKey[] = ['n', 'z', 'c', 'v', 'i', 'f', 't'];

/**
 * Status register flag values:
 * t = 0 for ARM, 1 for Thumb
 */
type StatusRegister = 'CPSR' | 'SPSR';
// A Q bit is also defined in the specification, but is not meant for use below ARM version 5.
type StatusRegisterKey = 'n' | 'z' | 'c' | 'v' | 'i' | 'f' | 't';
type StatusRegisterUpdate = StatusRegisterKey[];

class CPU implements CPUType {
    memory: Memory;
    cycles: number;
    currentGeneralRegisters = [] as number[];
    generalRegisters = [] as number[][];
    currentStatusRegisters = [] as number[];
    statusRegisters = [] as number[][];
    operatingMode = OperatingModes.usr;
    operatingState = 'ARM' as OperatingState;
    history = new StateHistory();
    profiler = new CPUProfiler();
    bigEndian = false;
    bootBIOS = false;
    historyEnabled = false;
    instructionSize = 4;
    breakpoints = new Set<number>();
    // Memory reads to BIOS must keep track of the mostly recently fetched BIOS instruction, so
    // the PC of that instruction is saved and updated here.
    lastBIOSPC = -1;
    breakpointCallback = () => {};

    constructor(memory: Memory) {
        this.memory = memory;
        this.memory.cpu = this;
        this.cycles = 0;
        this.currentGeneralRegisters = new Array<number>(16).fill(0);
        this.currentStatusRegisters = new Array<number>(2).fill(0);
        for (let i = 0; i < 7; i++) {
            this.generalRegisters.push(new Array<number>(16).fill(0));
            this.statusRegisters.push(new Array<number>(2).fill(0));
        }
        this.setGeneralRegister(Reg.PC, 0x00000008);
        this.setModeBits(OperatingModeCodes.sys);
    }

    loadProgram(program: Uint8Array) : void {
        this.memory.loadROM(program);
    }

    atBreakpoint() : boolean {
        return this.breakpoints.size > 0 && this.breakpoints.has(this.getGeneralRegister(Reg.PC) - this.instructionSize * 2);
    }

    step() : void {
        const pc = this.getGeneralRegister(Reg.PC);

        // Update BIOS PC tracker if executing within the BIOS.
        if (pc >= 0 && pc <= 0x3FFF) {
            this.lastBIOSPC = pc;
        }

        // PC points to the instruction after the next instruction, so we subtract 8 bytes.
        const instruction = this.operatingState === 'ARM' ?
            this.memory.getInt32(pc - 8).value :
            this.memory.getInt16(pc - 4).value;

        let options: ProcessedInstructionOptions = { incrementPC: true };
        if (this.operatingState === 'ARM' && this.conditionIsMet(instruction >>> 28)) {
            options = processARM(this, instruction);
            if (!options.incrementPC) {
                // Instruction updated PC, add wait state cycles for new PC
                this.cycles += this.memory.get32BitNonSeqWaitCycles(this.getGeneralRegister(Reg.PC));
                this.cycles += this.memory.get32BitSeqWaitCycles(this.getGeneralRegister(Reg.PC));
            }
        } else if (this.operatingState === 'THUMB') {
            options = processTHUMB(this, instruction);
            if (!options.incrementPC) {
                // Instruction updated PC, add wait state cycles for new PC
                this.cycles += this.memory.get16BitNonSeqWaitCycles(this.getGeneralRegister(Reg.PC));
                this.cycles += this.memory.get16BitSeqWaitCycles(this.getGeneralRegister(Reg.PC));
            }
        }

        const executedInterrupt = handleInterrupts(this, options);

        if (!executedInterrupt && options.incrementPC) {
            this.setGeneralRegister(Reg.PC, pc + this.instructionSize);
        }

    }

    /**
     * Clears out all registers and memory. Sets CPU to ARM user mode.
     */
    reset() : void {
        this.history.reset();
        this.cycles = 0;
        this.currentGeneralRegisters.fill(0);
        this.currentStatusRegisters.fill(0);
        for (let i = 0; i < this.generalRegisters.length; i++) {
            this.generalRegisters[i].fill(0);
        }
        this.statusRegisters[0].fill(0);
        this.statusRegisters[1].fill(0);
        this.operatingState = 'ARM';
        this.instructionSize = 4;
        this.bigEndian = false;
        this.setModeBits(OperatingModeCodes.sys);
        this.setStatusRegisterFlag('t', 0);
        this.bootBIOS = false;
        this.breakpoints.clear();

        if (this.bootBIOS) {
            this.setGeneralRegister(Reg.PC, 0x00000008);
        } else {
            this.setGeneralRegister(Reg.PC, 0x08000008);
        }

        // Setting default stack pointer values
        this.setGeneralRegister(Reg.SP, 0x03007F00);                        // SP for usr/sys mode
        this.generalRegisters[OperatingModes.svc][Reg.SP] = 0x03007FE0;     // SP for svc mode
        this.generalRegisters[OperatingModes.irq][Reg.SP] = 0x03007FA0;     // SP for irq mode
    }

    conditionIsMet(condition: number) : boolean {
        switch (condition) {
            case 0b0000: { return this.getStatusRegisterFlag('CPSR', 'z') === 1; }
            case 0b0001: { return this.getStatusRegisterFlag('CPSR', 'z') === 0; }
            case 0b0010: { return this.getStatusRegisterFlag('CPSR', 'c') === 1; }
            case 0b0011: { return this.getStatusRegisterFlag('CPSR', 'c') === 0; }
            case 0b0100: { return this.getStatusRegisterFlag('CPSR', 'n') === 1; }
            case 0b0101: { return this.getStatusRegisterFlag('CPSR', 'n') === 0; }
            case 0b0110: { return this.getStatusRegisterFlag('CPSR', 'v') === 1; }
            case 0b0111: { return this.getStatusRegisterFlag('CPSR', 'v') === 0; }
            case 0b1000: { return this.getStatusRegisterFlag('CPSR', 'c') === 1 && this.getStatusRegisterFlag('CPSR', 'z') === 0; }
            case 0b1001: { return this.getStatusRegisterFlag('CPSR', 'c') === 0 || this.getStatusRegisterFlag('CPSR', 'z') === 1; }
            case 0b1010: { return this.getStatusRegisterFlag('CPSR', 'n') === this.getStatusRegisterFlag('CPSR', 'v'); }
            case 0b1011: { return this.getStatusRegisterFlag('CPSR', 'n') !== this.getStatusRegisterFlag('CPSR', 'v'); }
            case 0b1100: { return this.getStatusRegisterFlag('CPSR', 'z') === 0 && this.getStatusRegisterFlag('CPSR', 'n') === this.getStatusRegisterFlag('CPSR', 'v'); }
            case 0b1101: { return this.getStatusRegisterFlag('CPSR', 'z') === 1 || this.getStatusRegisterFlag('CPSR', 'n') !== this.getStatusRegisterFlag('CPSR', 'v'); }
            case 0b1110: { return true; }
            case 0b1111: { return true; }
            default: { throw Error(`Invalid condition opcode 0b${(condition >>> 0).toString(2)}.`); }
        }
    }

    getStatusRegisterFlag(register: StatusRegister, flag: StatusRegisterKey) : number {
        let cpsr = this.getStatusRegister(register);
        const bitOffset = cpsrBitOffsetMapping[flag];
        return (cpsr >>> bitOffset) & 0x1;
    }

    setStatusRegisterFlag(flag: StatusRegisterKey, value: number | boolean) : void {
        let cpsr = this.currentStatusRegisters[0];
        const mask = 1 << cpsrBitOffsetMapping[flag];

        if (value) {
            cpsr |= mask;
        } else {
            cpsr &= ~mask;
        }

        if (flag === 't') {
            this.operatingState = value === 0 ? 'ARM' : 'THUMB';
            this.instructionSize = this.operatingState === 'ARM' ? 4 : 2;
        }

        this.currentStatusRegisters[0] = cpsr;
    }

    setModeBits(value: number) : void {
        const previousMode = this.currentStatusRegisters[0] & 0x1F;
        this.currentStatusRegisters[0] &= 0xFFFFFFE0;
        this.currentStatusRegisters[0] |= value;
        this.operatingMode = OperatingModeCodeToIndex[value & 0xF];
        this.updateCurrentRegisters(OperatingModeCodeToIndex[previousMode & 0xF], OperatingModeCodeToIndex[value & 0xF]);
    }

    spsrToCPSR() : void {
        if (this.operatingMode === OperatingModes.usr || this.operatingMode === OperatingModes.sys) {
            // No SPSR in User or System mode, so nothing to copy.
        } else {
            this.setStatusRegister("CPSR", this.currentStatusRegisters[1]);
        }
    }

    /**
     * When a mode switch occurs, the current general and status registers are
     * updated to those corresponding to the new mode.
     * 
     * General registers R0-R7 are all un-banked, so they are shared between all
     * operating modes. Un-banked register values are stored in the user mode
     * (index 0) general register during swaps. The remaining general registers
     * can be banked, meaning they can be saved and loaded in on mode switches.
     */
    updateCurrentRegisters(previousMode: number, newMode: number) : void {
        // R8 - R12 are banked only for FIQ mode.
        if (previousMode === OperatingModes.fiq) {
            for (let register = 8; register <= 12; register++) {
                this.generalRegisters[previousMode][register] = this.currentGeneralRegisters[register];
                this.currentGeneralRegisters[register] = this.generalRegisters[0][register];
            }
        } else if (newMode === OperatingModes.fiq) {
            for (let register = 8; register <= 12; register++) {
                this.generalRegisters[0][register] = this.currentGeneralRegisters[register];
                this.currentGeneralRegisters[register] = this.generalRegisters[newMode][register];
            }
        }

        // R13 - R14 are banked for modes SVC, ABT, UND, IRQ, and FIQ.
        if (previousMode >= OperatingModes.fiq && previousMode <= OperatingModes.und) {
            this.generalRegisters[previousMode][13] = this.currentGeneralRegisters[13];
            this.generalRegisters[previousMode][14] = this.currentGeneralRegisters[14];

            // System mode (index 6) is banked with user mode (index 0). All other modes are
            // individual, so the new mode can be used directly.
            const newModeIndex = newMode === 6 ? 0 : newMode;
            this.currentGeneralRegisters[13] = this.generalRegisters[newModeIndex][13];
            this.currentGeneralRegisters[14] = this.generalRegisters[newModeIndex][14];
        } else if (newMode >= OperatingModes.fiq && newMode <= OperatingModes.und) {
            this.generalRegisters[0][13] = this.currentGeneralRegisters[13];
            this.generalRegisters[0][14] = this.currentGeneralRegisters[14];
            this.currentGeneralRegisters[13] = this.generalRegisters[newMode][13];
            this.currentGeneralRegisters[14] = this.generalRegisters[newMode][14];
        }

        // Update SPSR registers
        if ((previousMode >= OperatingModes.fiq && previousMode <= OperatingModes.und) ||
            (newMode >= OperatingModes.fiq && newMode <= OperatingModes.und)) {
            this.statusRegisters[previousMode][1] = this.currentStatusRegisters[1];
            this.currentStatusRegisters[1] = this.statusRegisters[newMode][1];
        }
    }

    /**
     * There are two status registers, CPSR (Current Program Status Register)
     * and SPSR (Saved Program Status Register). CPSR is the same for all
     * operating modes, and SPSR is banked for all operating modes with the
     * exception of System and User modes, where it is not accessible. Both
     * ARM and THUMB state have this status register setup.
     */
    getStatusRegister(reg: StatusRegister): number {
        if (reg === 'SPSR' && (this.operatingMode == OperatingModes.usr || this.operatingMode === OperatingModes.sys)) {
            throw Error(`Cannot access SPSR in operating mode ${this.operatingMode}.`);
        }
        switch (reg) {
            case 'CPSR': return this.currentStatusRegisters[0];
            case 'SPSR': return this.currentStatusRegisters[1];
        }
    }

    setGeneralRegister(reg: number, value: number): void {
        this.currentGeneralRegisters[reg] = value;
    }

    setStatusRegister(reg: StatusRegister, value: number, saveCPSR: boolean = false): void {
        switch (reg) {
            case 'CPSR': {
                const previousCPSR = this.getStatusRegister("CPSR");

                const mode = value & 0x1F;
                this.setModeBits(mode);

                const tFlag = (value >>> cpsrBitOffsetMapping['t']) & 0x1;
                this.setStatusRegisterFlag('t', tFlag);

                this.currentStatusRegisters[0] = value;
                if (saveCPSR && this.currentModeHasSPSR()) {
                    this.currentStatusRegisters[1] = previousCPSR;
                }
                break;
            };
            case 'SPSR': {
                if (this.currentModeHasSPSR()) {
                    this.currentStatusRegisters[1] = value;
                    break;
                } else {
                    throw Error(`Cannot set ${reg} in mode ${OperatingModeNames[this.operatingMode]}.`);
                }
            };
        }
    }

    getGeneralRegister(reg: number): number {
        return this.currentGeneralRegisters[reg] >>> 0;
    }

    getGeneralRegisterByMode(reg: number, mode: number) : number {
        if (this.operatingMode === mode || reg <= 7 || reg === 15) {
            return this.currentGeneralRegisters[reg];
        } else {
            return this.generalRegisters[mode][reg];
        }
    }

    inAPrivilegedMode() : boolean {
        return this.operatingMode !== OperatingModes.usr;
    }

    currentModeHasSPSR() : boolean {
        return (
            this.operatingMode !== OperatingModes.usr &&
            this.operatingMode !== OperatingModes.sys
        );
    }

    setBreakpoint(address: number) {
        this.breakpoints.add(address);
    }

    removeBreakpoint(address: number) {
        this.breakpoints.delete(address);
    }

}

export { CPU, OperatingModeCodes, OperatingModes, Reg, statusRegisterFlags, cpsrBitOffsetMapping, OperatingModeNames }
export type { CPUType, StatusRegisterUpdate, OperatingState, StatusRegisterKey }
