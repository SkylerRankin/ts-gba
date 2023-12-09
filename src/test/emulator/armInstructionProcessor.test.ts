import { getShiftOperandValue, processARM } from "../../emulator/armInstructionProcessors";
import { CPU, StatusRegisterKey } from "../../emulator/cpu";
import { readFileSync } from "fs";
import { toBigEndianInt32 } from "../../emulator/math";

const jestPrefix = { showPrefix: false };

test("Identify ARM op-codes", () => {
    const cpu = new CPU();

    const test_cases = readFileSync("src/test/emulator/data/opcodes_arm.txt").toString()
        .split(/\r?\n/)
        .filter(line => !line.startsWith("#") && line.length > 0)
        .map(line => {
            const encoding = Number(line.substring(0, line.indexOf(" ")));
            const name = line.substring(line.indexOf("[") + 1, line.indexOf("]"));
            return { name, encoding };
        });

    test_cases.forEach(e => {
        const bigEndianEncoding = toBigEndianInt32(e.encoding);
        processARM(cpu, bigEndianEncoding);
        expect(cpu.history.currentLog.instructionName).toBe(e.name);
    });
});

test("Determine data processing shift operand values/carries", () => {
    const cpu = new CPU();
    const mockCFlag = 123;

    // Mock the C flag to be a unique value to ensure the function is
    // actually using that value when necessary for the carry-out.
    jest.spyOn(cpu, "getStatusRegisterFlag").mockImplementation(i => { return mockCFlag; });

    // Set general purpose register values for tests.
    for (let i = 0; i <= 15; i++) {
        cpu.setGeneralRegister(i, i);
    }

    // Set register values to test the various shift behaviors. Bytes 8-15 are all 1 to ensure
    // only the relevant lower 8 bits are being used.
    // R7[7:0] = 0
    cpu.setGeneralRegister(7, 0xFF00);
    // R8[7:0] = 10
    cpu.setGeneralRegister(8, 0xFF0A);
    // R9[7:0] = 32
    cpu.setGeneralRegister(9, 0xFF20);
    // R10[7:0] = 64
    cpu.setGeneralRegister(10, 0xFFFFFF40);

    const test_cases = readFileSync("src/test/emulator/data/shift_operands_arm.txt").toString()
        .split(/\r?\n/)
        .filter(line => !line.startsWith("#") && line.length > 0)
        .map(line => {
            const items = line.split(" ");
            return {
                instruction: Number.parseInt(items[0]),
                expectedValue: Number.parseInt(items[1]),
                expectedCarry: items[2] === "CFlag" ? mockCFlag : Number.parseInt(items[2])
            }
        });

    expect(test_cases.length).toBe(29);
    test_cases.forEach(t => {
        const [value, carry] = getShiftOperandValue(cpu, t.instruction);
        expect(value >>> 0).toBe(t.expectedValue);
        expect(carry).toBe(t.expectedCarry);
    });
});

test.only("Execute data processing ARM instructions", () => {
    const cpu = new CPU();
    cpu.reset();

    const test_cases = readFileSync("src/test/emulator/data/data_processing_arm.txt").toString()
        .split(/\r?\n/)
        .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
        .filter(i => !i.line.startsWith("#") && i.line.length > 0)
        .map(i => {
            let line = i.line;
            const inlineCommentIndex = line.lastIndexOf("#");
            if (inlineCommentIndex !== -1) line = line.substring(0, inlineCommentIndex).trim();

            // Special lines for manually setting register/flag values.
            if (line.startsWith("SET")) {
                const {registerUpdates, flagUpdates} = parseUpdateString(line.substring(4).trim());
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
                let updatesText = line.substring(line.indexOf("[", updatesIndex) + 1);
                if (updatesText.endsWith("]")) {
                    updatesText = updatesText.substring(0, updatesText.length - 1);
                }

                const updateObjects = parseUpdateString(updatesText);
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
        processARM(cpu, t.instruction);
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
});

const parseUpdateString = (text: string) => {
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
