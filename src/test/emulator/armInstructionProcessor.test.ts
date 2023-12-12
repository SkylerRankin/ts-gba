import { getShiftOperandValue, processARM } from "../../emulator/armInstructionProcessors";
import { CPU } from "../../emulator/cpu";
import { readFileSync } from "fs";
import { toBigEndianInt32 } from "../../emulator/math";
import { executeInstructionTestFile } from "./test_utilities";

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

test("Execute data processing ARM instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/data_processing_arm.txt", processARM)
});
