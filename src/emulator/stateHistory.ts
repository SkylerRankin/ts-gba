import { OperatingState, CPU, Reg, OperatingMode } from './cpu';
import { byteArrayToInt32 } from './math';

type HistoryLog = {
    operatingState: OperatingState,
    operatingMode: OperatingMode,
    instructionName: string,
    instruction: number,
    conditionMet: boolean,
    pc: number,
    errors: string[]
};

const emptyHistoryLog: HistoryLog = {
    operatingState: 'ARM',
    operatingMode: 'und',
    instructionName: '',
    instruction: 0,
    conditionMet: false,
    pc: 0,
    errors: []
};

interface StateHistoryType {
    logs: HistoryLog[]
    currentLog: HistoryLog
    startLog: () => void
    endLog: () => void
    reset: () => void
    toString: (i: number) => string
    logCPU: (cpu: CPU) => void
    setInstructionName: (name: string) => void
} 

class StateHistory implements StateHistoryType {
    logs = [] as HistoryLog[];
    currentLog = {...emptyHistoryLog};

    startLog() { this.currentLog = {...emptyHistoryLog}; }
    endLog() {
        if (this.currentLog.instructionName) {
            this.currentLog.instructionName += ` (0x${this.currentLog.instruction.toString(16).padStart(8, '0')})`;
        }
        this.logs.push(this.currentLog);
    }

    reset() {
        this.logs = [];
        this.currentLog = {...emptyHistoryLog};
    }

    logCPU(cpu: CPU) {
        const pc = cpu.getGeneralRegister(Reg.PC);
        const instructionSize = cpu.operatingState === 'ARM' ? 4 : 2;
        const instruction = byteArrayToInt32(cpu.memory.getBytes(pc - 8, instructionSize), cpu.bigEndian);

        this.currentLog.operatingState = cpu.operatingState;
        this.currentLog.operatingMode = cpu.operatingMode;
        this.currentLog.instruction = instruction;
        this.currentLog.pc = pc;
    }
    setInstructionName(name: string) { this.currentLog.instructionName = name; }
    addError(message: string) { this.currentLog.errors.push(message); }

}

export { StateHistory }
