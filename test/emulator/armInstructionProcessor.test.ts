// import { getShiftOperandValue, processARM } from "emulator/armInstructionProcessors";
import { CPU } from "../../src/emulator/cpu";
import { readFileSync } from "fs";
import { toBigEndianInt32 } from "../../src/emulator/math";
import { executeInstructionTestFile, executeLoadStoreAddressTestFile } from "./test_utilities";
import { Memory } from "../../src/emulator/memory";
import { getShiftOperandValue, processARM } from "../../src/emulator/armInstructionProcessors";

test("Identify ARM op-codes", () => {
    const memory = new Memory();
    const cpu = new CPU(memory);

    const test_cases = readFileSync("./test/emulator/data/opcodes_arm.txt").toString()
        .split(/\r?\n/)
        .filter(line => !line.startsWith("#") && line.length > 0)
        .map(line => {
            const encoding = Number(line.substring(0, line.indexOf(" ")));
            const name = line.substring(line.indexOf("[") + 1, line.indexOf("]"));
            return { name, encoding };
        });

    test_cases.forEach(e => {
        const bigEndianEncoding = toBigEndianInt32(e.encoding);
        // Test each instruction in supervisor mode
        cpu.setModeBits(0x13);
        processARM(cpu, bigEndianEncoding);
        expect(cpu.history.currentLog.instructionName).toBe(e.name);
    });
});

test("Determine data processing shift operand values/carries (addressing mode 1)", () => {
    const memory = new Memory();
    const cpu = new CPU(memory);
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

    const test_cases = readFileSync("./test/emulator/data/addressing_mode_1_arm.txt").toString()
        .split(/\r?\n/)
        .map((text, i) => ({line: text, lineNumber: i + 1}))
        .filter(({line, lineNumber}) => !line.startsWith("#") && line.length > 0)
        .map(({line, lineNumber}) => {
            const items = line.split(" ");
            return {
                lineNumber,
                instruction: Number.parseInt(items[0]),
                expectedValue: Number.parseInt(items[1]),
                expectedCarry: items[2] === "CFlag" ? mockCFlag : Number.parseInt(items[2])
            }
        });

    expect(test_cases.length).toBe(31);
    test_cases.forEach(t => {
        const [value, carry] = getShiftOperandValue(cpu, t.instruction);
        expect(value >>> 0, `Line ${t.lineNumber}: Expected value to be 0x${(t.expectedValue >>> 0).toString(16)}, but got 0x${(value >>> 0).toString(16)}.`).toBe(t.expectedValue);
        expect(carry, `Line ${t.lineNumber}: Expected carry to be 0x${(t.expectedCarry >>> 0).toString(16)}, but got 0x${(carry >>> 0).toString(16)}.`).toBe(t.expectedCarry);
    });
});

test('Determine load/store addresses (addressing mode 2)', () => {
    executeLoadStoreAddressTestFile("test/emulator/data/addressing_mode_2_arm.txt", false);
});

test('Determine load/store addresses (addressing mode 3)', () => {
    executeLoadStoreAddressTestFile("test/emulator/data/addressing_mode_3_arm.txt", false);
});

test('Determine load/store multiple addresses (addressing mode 4)', () => {
    executeLoadStoreAddressTestFile("test/emulator/data/addressing_mode_4_arm.txt", true);
});

test("Execute data processing ARM instructions", () => {
    executeInstructionTestFile("test/emulator/data/data_processing_arm.txt", processARM)
});

test("Execute branch ARM instructions", () => {
    executeInstructionTestFile("./test/emulator/data/branch_arm.txt", processARM);
});

test("Execute multiply ARM instructions", () => {
    executeInstructionTestFile("./test/emulator/data/multiply_arm.txt", processARM);
})

test("Execute status register access ARM instructions", () => {
    executeInstructionTestFile("./test/emulator/data/status_register_access_arm.txt", processARM);
});

test("Execute semaphore ARM instructions", () => {
    executeInstructionTestFile("./test/emulator/data/semaphore_arm.txt", processARM);
});

test("Execute load/store ARM instructions", () => {
    executeInstructionTestFile("./test/emulator/data/load_store_arm.txt", processARM);
});

test("Execute load/store multiple ARM instructions", () => {
    executeInstructionTestFile("./test/emulator/data/load_store_multiple_arm.txt", processARM);
});
