import { readFileSync } from "fs";
import { CPU, StatusRegisterKey } from "../../emulator/cpu";

const parseInstructionFileUpdateString = (text: string) => {
    const registerUpdates: { [key: number]: number; } = {};
    const flagUpdates: { [key: string]: number; } = {};
    text.split(",")
        .map(i => i.trim().toLowerCase())
        .filter(i => i.length > 0)
        .forEach(i => {
            const equalsIndex = i.indexOf("=");
            if (i.startsWith("r")) {
                const register = Number.parseInt(i.substring(1, equalsIndex));
                expect(register >= 0 && register <= 15).toBeTruthy();
                const value = Number.parseInt(i.substring(equalsIndex + 1)) >>> 0;
                registerUpdates[register] = value;
            } else {
                const validFlags = ["n", "z", "c", "v"];
                const flag = i.substring(0, equalsIndex);
                expect(validFlags.includes(flag)).toBeTruthy();
                const value = Number.parseInt(i.substring(equalsIndex + 1));
                flagUpdates[flag] = value;
            }
        });
    return { registerUpdates, flagUpdates };
}

const executeInstructionTestFile = (filePath: string, processingFunction: any) => {
    const cpu = new CPU();
    cpu.reset();
    const test_cases = readFileSync(filePath).toString()
        .split(/\r?\n/)
        .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
        .filter(i => !i.line.startsWith("#") && i.line.length > 0)
        .map(i => {
            let line = i.line;

            // Special lines for manually setting register/flag values.
            if (line.startsWith("SET")) {
                const {registerUpdates, flagUpdates} = parseInstructionFileUpdateString(line.substring(4).trim());
                return {
                    instruction: undefined,
                    registerUpdates,
                    flagUpdates,
                    lineNumber: i.lineNumber
                };
            }

            const spaceIndex = line.indexOf(" ");
            const instruction = Number.parseInt(line.substring(0, spaceIndex)) >>> 0;
            let registerUpdates: { [key: number]: number; } = {};
            let flagUpdates: { [key: string]: number; } = {};

            const updatesIndex = line.indexOf("Updates=");
            if (updatesIndex !== -1) {
                let updatesText = line.substring(line.indexOf("[", updatesIndex) + 1, line.indexOf("]"));

                const updateObjects = parseInstructionFileUpdateString(updatesText);
                registerUpdates = updateObjects.registerUpdates;
                flagUpdates = updateObjects.flagUpdates;
            }

            return { instruction, registerUpdates, flagUpdates, lineNumber: i.lineNumber };
        });

    const statusRegisterKeys = ['n', 'z', 'c', 'v'] as StatusRegisterKey[];

    test_cases.forEach(t => {
        if (!t.instruction) {
            Object.entries(t.registerUpdates).forEach(([register, value]) => {
                cpu.setGeneralRegister(Number.parseInt(register), value);
            });
            Object.entries(t.flagUpdates).forEach(([flag, value]) => {
                expect(['n', 'z', 'c', 'v'].includes(flag)).toBeTruthy();
                const conditionFlag = flag as "n" | "z" | "c" | "v";
                if (value === 0) cpu.clearConditionCodeFlags(conditionFlag);
                else if (value === 1) cpu.setConditionCodeFlags(conditionFlag);
            });
            return;
        }

        const previousRegisters = cpu.generalRegisters[0].map(v => v >>> 0);
        const previousCPSRFlags = statusRegisterKeys.map(f => cpu.getStatusRegisterFlag(f));
        processingFunction(cpu, t.instruction);
        const updatedRegisters = cpu.generalRegisters[0].map(v => v >>> 0);
        const updatedCPSRFlags = statusRegisterKeys.map(f => cpu.getStatusRegisterFlag(f));

        for (let i = 0; i < 16; i++) {
            if (i in t.registerUpdates) {
                expect(updatedRegisters[i], `Line ${t.lineNumber}: ${t.instruction.toString(16)}: Expected R${i} to be updated to 0x${(t.registerUpdates[i] >>> 0).toString(16)}, but was 0x${updatedRegisters[i].toString(16)}.`).toBe(t.registerUpdates[i]);
            } else {
                expect(updatedRegisters[i], `Line ${t.lineNumber}: ${t.instruction.toString(16)}: Expected R${i} to be unchanged with value 0x${(previousRegisters[i] >>> 0).toString(16)}, but was 0x${updatedRegisters[i].toString(16)}.`).toBe(previousRegisters[i]);
            }
        }

        ['n', 'z', 'c', 'v'].forEach((flag, i) => {
            if (flag in t.flagUpdates) {
                expect(updatedCPSRFlags[i], `Line ${t.lineNumber}: ${t.instruction.toString(16)}: Expected flag ${flag} to be updated to ${t.flagUpdates[flag]}, but was ${updatedCPSRFlags[i]}.`).toBe(t.flagUpdates[flag]);
            } else {
                expect(updatedCPSRFlags[i], `Line ${t.lineNumber}: ${t.instruction.toString(16)}: Expected flag ${flag} to be unchanged with value ${previousCPSRFlags[i]}, but was ${updatedCPSRFlags[i]}.`).toBe(previousCPSRFlags[i]);
            }
        });
    });
};


export { executeInstructionTestFile };
