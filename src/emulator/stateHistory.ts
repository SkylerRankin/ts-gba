// import { writeFileSync } from 'fs';
import { OperatingState, CPU, Reg } from './cpu';
import { byteArrayToInt32 } from './math';

type HistoryLog = {
    operatingState: OperatingState,
    operatingMode: number,
    instructionName: string,
    instruction: number,
    conditionMet: boolean,
    pc: number,
    cpsr: number,
    errors: string[]
};

const emptyHistoryLog: HistoryLog = {
    operatingState: 'ARM',
    operatingMode: 0,
    instructionName: '',
    instruction: 0,
    conditionMet: false,
    pc: 0,
    cpsr: 0,
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
    saveToFile: () => void
} 

class StateHistory implements StateHistoryType {
    logs = [] as HistoryLog[];
    currentLog = {...emptyHistoryLog};

    startLog() {
        this.currentLog = {...emptyHistoryLog};
    }

    endLog() {
        if (this.currentLog.instructionName) {
            const padding = this.currentLog.operatingState === 'ARM' ? 8 : 4;
            this.currentLog.instructionName += ` (0x${this.currentLog.instruction.toString(16).padStart(padding, '0')})`;
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
        const instruction = byteArrayToInt32(cpu.memory.getBytes(pc - (instructionSize * 2), instructionSize), cpu.bigEndian);

        this.currentLog.operatingState = cpu.operatingState;
        this.currentLog.operatingMode = cpu.operatingMode;
        this.currentLog.instruction = instruction;
        this.currentLog.cpsr = cpu.getStatusRegister('CPSR');
        this.currentLog.pc = pc - (instructionSize * 2);
    }
    setInstructionName(name: string) { this.currentLog.instructionName = name; }
    addError(message: string) { this.currentLog.errors.push(message); }

    saveToFile() {
        let data = "";
        const hex = (s: number) => s.toString(16).padStart(8, '0');

        this.logs.forEach(log => {
            if (log.conditionMet) {
                data += `${hex(log.pc)} - ${log.instructionName} (${log.operatingState}) (${log.operatingMode}) cpsr=${hex(log.cpsr)}`;
            } else {
                data += `${hex(log.pc)} - ${hex(log.instruction)} [condition failed] cpsr=${hex(log.cpsr)}`;
            }
            data += "\n";
        });

        const date = new Date();
        const filename = `./logs/cpu_state_history_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.txt`;
        // writeFileSync(filename, data);
    }

}

export { StateHistory }
