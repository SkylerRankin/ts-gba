import { processARM, ProcessedInstructionOptions } from './armInstructionProcessors';
import { processTHUMB } from './thumbInstructionProcessors';
import { Memory } from './memory';
import { StateHistory } from './stateHistory';
import { byteArrayToInt32 } from './math';
import { CPUProfiler } from './cpuProfiler';

/**
 * A simulator for a CPU that implements the ARMv4T ISA.
 * This includes 32 bit instructions, 31 general use registers, 6 status registers.
 */

type CPUType = {
    memory: Memory,
    generalRegisters: number[][],
    statusRegisters: number[][],
    operatingMode: OperatingMode,
    operatingState: OperatingState,
    history: StateHistory,
    profiler: CPUProfiler,
    bigEndian: boolean,
    historyEnabled: boolean,
    
    reset: () => void,
    step: () => void,
    atBreakpoint: () => boolean,
    
    getStatusRegisterFlag(register: StatusRegister, flag: StatusRegisterKey) : number,
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
    'und': 0b11011,
    'sys': 0b11111
};
const OperatingModeNames = ['usr', 'fiq', 'irq', 'svc', 'abt', 'und', 'sys'];
type OperatingMode = 'usr' | 'fiq' | 'irq' | 'svc' | 'abt' | 'und' | 'sys';
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
        [Reg.SP, Reg.LR], // UND
        [], // SYS
    ],
    'THUMB': [
        [], // User
        [Reg.SP, Reg.LR], // FIQ
        [Reg.SP, Reg.LR], // IRQ
        [Reg.SP, Reg.LR], // SVC
        [Reg.SP, Reg.LR], // ABT
        [Reg.SP, Reg.LR], // UND
        [], // SYS
    ]
};

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
    generalRegisters = [] as number[][];
    statusRegisters = [] as number[][];
    operatingMode = 'usr' as OperatingMode;
    operatingState = 'ARM' as OperatingState;
    history = new StateHistory();
    profiler = new CPUProfiler();
    bigEndian = false;
    bootBIOS = true;
    historyEnabled = false;

    constructor(memory: Memory) {
        this.memory = memory;
        for (let i = 0; i < 7; i++) {
            this.generalRegisters.push(new Array<number>(16).fill(0));
            this.statusRegisters.push(new Array<number>(2).fill(0));
        }
        this.statusRegisters[0][0] = (0b1011 << 28 >>> 0) || 0b11011;
        this.setGeneralRegister(Reg.PC, 0x00000008);
        this.setModeBits(OperatingModeCodes.sys);
    }

    loadProgram(program: Uint8Array) : void {
        this.memory.loadROM(program);
    }

    atBreakpoint() : boolean {
        // For testing, stop when the instruction is nop
        return false;
        // return this.rom[this.generalRegisters[this.operatingMode][Reg.PC]] == 0 || this.rom[this.generalRegisters[Reg.PC]] == undefined;
    }

    step() : void {
        if (this.historyEnabled) {
            this.history.startLog();
            this.history.logCPU(this);
        }

        const pc = this.getGeneralRegister(Reg.PC);
        const instructionSize = this.operatingState === 'ARM' ? 4 : 2;
        // PC points to the instruction after the next instruction, so we subtract 8 bytes.
        const instruction = byteArrayToInt32(this.memory.getBytes(pc - (instructionSize * 2), instructionSize), this.bigEndian);
        const condition = instruction >>> 28;
        let options: ProcessedInstructionOptions | undefined;

        if (this.operatingState === 'ARM' && this.conditionIsMet(condition)) {
            this.history.currentLog.conditionMet = true;
            this.profiler.startInstructionExecution();
            options = processARM(this, instruction);
            this.profiler.endInstructionExecution();
        } else if (this.operatingState === 'THUMB') {
            this.history.currentLog.conditionMet = true;
            this.profiler.startInstructionExecution();
            options = processTHUMB(this, instruction);
            this.profiler.endInstructionExecution();
        }

        if (!options || options.incrementPC) {
            this.setGeneralRegister(Reg.PC, pc + instructionSize);
        }

        if (this.historyEnabled) {
            this.history.endLog();
        }
    }

    /**
     * Clears out all registers and memory. Sets CPU to ARM user mode.
     */
    reset() : void {
        this.history.reset();
        this.generalRegisters.fill(new Array<number>(16).fill(0), 0, this.generalRegisters.length);
        this.statusRegisters.fill(new Array<number>(2).fill(0), 0, this.generalRegisters.length);
        this.operatingState = 'ARM';
        this.bigEndian = false;
        this.setModeBits(OperatingModeCodes.sys);
        this.setStatusRegisterFlag('t', 0);

        if (this.bootBIOS) {
            this.setGeneralRegister(Reg.PC, 0x00000008);
        } else {
            this.setGeneralRegister(Reg.PC, 0x08000008);
        }
    }

    conditionIsMet(condition: number) : boolean {
        const nFlag = this.getStatusRegisterFlag('CPSR', 'n');
        const zFlag = this.getStatusRegisterFlag('CPSR', 'z');
        const cFlag = this.getStatusRegisterFlag('CPSR', 'c');
        const vFlag = this.getStatusRegisterFlag('CPSR', 'v');

        switch (condition) {
            case 0b0000: { return zFlag === 1; }
            case 0b0001: { return zFlag === 0; }
            case 0b0010: { return cFlag === 1; }
            case 0b0011: { return cFlag === 0; }
            case 0b0100: { return nFlag === 1; }
            case 0b0101: { return nFlag === 0; }
            case 0b0110: { return vFlag === 1; }
            case 0b0111: { return vFlag === 0; }
            case 0b1000: { return cFlag === 1 && zFlag === 0; }
            case 0b1001: { return cFlag === 0 || zFlag === 1; }
            case 0b1010: { return nFlag === vFlag; }
            case 0b1011: { return nFlag !== vFlag; }
            case 0b1100: { return zFlag === 0 && nFlag === vFlag; }
            case 0b1101: { return zFlag === 1 || nFlag !== vFlag; }
            case 0b1110: { return true; }
            case 0b1111: { return true; }
            default: { throw Error(`Invalid condition opcode 0b${(condition >>> 0).toString(2)}.`); }
        }
    }

    clearConditionCodeFlags() : void {
        ['n', 'z', 'c', 'v'].forEach(flag => {
            this.setStatusRegisterFlag(flag as StatusRegisterKey, 0);
        });
    }

    getStatusRegisterFlag(register: StatusRegister, flag: StatusRegisterKey) : number {
        let cpsr = this.getStatusRegister(register);
        const bitOffset = cpsrBitOffsetMapping[flag];
        return (cpsr >>> bitOffset) & 0x1;
    }

    setStatusRegisterFlag(flag: StatusRegisterKey, value: number) : void {
        let cpsr = this.getStatusRegister('CPSR');
        const mask = 1 << cpsrBitOffsetMapping[flag];

        if (value === 0) {
            cpsr &= ~mask;
        } else {
            cpsr |= mask;
        }

        if (flag === 't') {
            this.operatingState = value === 0 ? 'ARM' : 'THUMB';
        }

        this.statusRegisters[0][0] = cpsr;
    }

    setModeBits(value: number) : void {
        const modeEncoding = Object.entries(OperatingModeCodes).find(([k, v]) => v == value);
        if (modeEncoding) {
            this.statusRegisters[0][0] &= ~0x1F;
            this.statusRegisters[0][0] |= value;
            this.operatingMode = modeEncoding[0] as OperatingMode;
        } else {
            throw Error(`Invalid mode bits ${value.toString(2)}`);
        }
    }

    spsrToCPSR() : void {
        if (this.operatingMode === 'usr' || this.operatingMode === 'sys') {
            // No SPSR in User or System mode, so nothing to copy.
        } else {
            const operatingModeIndex = OperatingModeNames.indexOf(this.operatingMode);
            this.statusRegisters[0][0] = this.statusRegisters[operatingModeIndex][1];
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
        if (reg === 'SPSR' && (this.operatingMode == 'usr' || this.operatingMode === 'sys')) {
            throw Error(`Cannot access SPSR in operating mode ${this.operatingMode}.`);
        }
        const operatingModeIndex = OperatingModeNames.indexOf(this.operatingMode);
        switch (reg) {
            case 'CPSR': return this.statusRegisters[0][0];
            case 'SPSR': return this.statusRegisters[operatingModeIndex][1];
        }
    }

    setGeneralRegister(reg: number, value: number): void {
        const operatingModeIndex = OperatingModeNames.indexOf(this.operatingMode);
        if (BankedRegisters[this.operatingState][operatingModeIndex].includes(reg)) {
            this.generalRegisters[operatingModeIndex][reg] = value;
        } else {
            this.generalRegisters[0][reg] = value;
        }
    }

    setStatusRegister(reg: StatusRegister, value: number): void {
        switch (reg) {
            case 'CPSR': {
                const mode = value & 0x1F;
                this.setModeBits(mode);

                const tFlag = (value >>> cpsrBitOffsetMapping['t']) & 0x1;
                this.setStatusRegisterFlag('t', tFlag);

                this.statusRegisters[0][0] = value;
                break;
            };
            case 'SPSR': {
                const operatingModeIndex = OperatingModeNames.indexOf(this.operatingMode);
                if (this.currentModeHasSPSR()) {
                    this.statusRegisters[operatingModeIndex][1] = value;
                    break;
                } else {
                    throw Error(`Cannot set ${reg} in mode ${OperatingModeNames[operatingModeIndex]}.`);
                }
            };
        }
    }

    setGeneralRegisterByMode(reg: number, value: number, mode: OperatingMode) : void {
        this.generalRegisters[OperatingModeNames.indexOf(mode)][reg] = value;
    }

    getGeneralRegister(reg: number): number {
        const operatingModeIndex = OperatingModeNames.indexOf(this.operatingMode);
        if (BankedRegisters[this.operatingState][operatingModeIndex].includes(reg)) {
            return this.generalRegisters[operatingModeIndex][reg];
        } else {
            return this.generalRegisters[0][reg];
        }
    }

    getGeneralRegisterByMode(reg: number, mode: OperatingMode) : number {
        return this.generalRegisters[OperatingModeNames.indexOf(mode)][reg];
    }

    getStateSummary() : {[key: string] : string | number | number[]} {
        const modeBits = this.getStatusRegister('CPSR') & 0x1F;
        const modeName = Object.values(OperatingModeCodes).includes(modeBits) ?
            OperatingModeNames[Object.values(OperatingModeCodes).indexOf(modeBits)].toUpperCase() :
            'ERR';

        const state = (this.getStatusRegister('CPSR') & 0x20) === 0 ? 'ARM' : 'THB';

        let registers = [];
        if (this.operatingState === 'ARM') {
            for (let i = 0; i < 16; i++) {
                registers.push((this.getGeneralRegister(i) >>> 0));
            }
        } else {
            [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 15].forEach(i => {
                registers.push((this.getGeneralRegister(i) >>> 0));
            });
        }

        const cpsr = this.getStatusRegister('CPSR');

        const flags =
            (this.getStatusRegisterFlag('CPSR', 'n') === 1 ? 'N' : '-') +
            (this.getStatusRegisterFlag('CPSR', 'z') === 1 ? 'Z' : '-') +
            (this.getStatusRegisterFlag('CPSR', 'c') === 1 ? 'C' : '-') +
            (this.getStatusRegisterFlag('CPSR', 'v') === 1 ? 'V' : '-') +
            ' ' +
            (this.getStatusRegisterFlag('CPSR', 'i') === 1 ? 'I' : '-') +
            (this.getStatusRegisterFlag('CPSR', 'f') === 1 ? 'F' : '-') +
            (this.getStatusRegisterFlag('CPSR', 't') === 1 ? 'Y' : '-');

        let summary = {
            mode: modeName,
            state: state,
            registers: registers,
            cpsr: cpsr,
            flags: flags
        };

        return summary;
    }

    getBytesFromMemory(address: number, bytes: number) : Uint8Array {
        // TODO enforce which memory blocks can be read in which operating mode
        return this.memory.getBytes(address, bytes);
    }

    setBytesInMemory(address: number, bytes: Uint8Array) : void {
        // TODO enforce which memory blocks can be written in which operating mode
        this.memory.setBytes(address, bytes);
    }

    inAPrivilegedMode() : boolean {
        return this.operatingMode !== 'usr';
    }

    currentModeHasSPSR() : boolean {
        return (
            this.operatingMode !== 'usr' &&
            this.operatingMode !== 'sys'
        );
    }

}

export { CPU, OperatingModeCodes, Reg, statusRegisterFlags, cpsrBitOffsetMapping, OperatingModeNames }
export type { CPUType, StatusRegisterUpdate, OperatingMode, OperatingState, StatusRegisterKey }
