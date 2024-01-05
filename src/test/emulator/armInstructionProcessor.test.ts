import { getLoadStoreAddress, getShiftOperandValue, processARM } from "../../emulator/armInstructionProcessors";
import { CPU, StatusRegisterKey, statusRegisterFlags } from "../../emulator/cpu";
import { readFileSync } from "fs";
import { parseNumericLiteral, toBigEndianInt32 } from "../../emulator/math";
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
        // Test each instruction in supervisor mode
        cpu.setModeBits(0x13);
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

test('Determine load/store addresses (addressing modes 2)', () => {
    const cpu: CPU = new CPU();
    const rn = 1;

    readFileSync("src/test/emulator/data/addressing_mode_2_arm.txt").toString()
        .split("\r\n")
        .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
        .filter(i => i.line.length > 0 && !i.line.startsWith("#"))
        .forEach(i => {
            const line = i.line;
            if (line.startsWith("SET")) {
                line.substring(4).split(",").map(i => i.trim()).forEach(i => {
                    if (i.toLowerCase().startsWith("r")) {
                        const register = Number.parseInt(i.substring(1, i.indexOf("=")));
                        const value = parseNumericLiteral(i.substring(i.indexOf("=") + 1));
                        expect(register >= 0 && register <= 15).toBeTruthy();
                        cpu.setGeneralRegister(register, value);
                    } else {
                        const flag = i.substring(0, i.indexOf("=")).toLowerCase() as StatusRegisterKey;
                        expect(statusRegisterFlags.includes(flag)).toBeTruthy();
                        const value = parseNumericLiteral(i.substring(i.indexOf("=") + 1));
                        cpu.setStatusRegisterFlag(flag, value);
                    }
                });
            } else {
                const items = line.split(",").map(i => i.trim());
                const instruction = parseNumericLiteral(items[0].substring(12));
                const expectedAddress = parseNumericLiteral(items[1].substring(8)) >>> 0;
                const expectedRnUpdate = items.length === 3 ? parseNumericLiteral(items[2].substring(3)) : undefined;

                const previousRnValue = cpu.getGeneralRegister(rn);
                const address = getLoadStoreAddress(cpu, instruction);
                expect(address, `Line ${i.lineNumber}: Expected address to be 0x${expectedAddress.toString(16)} but got 0x${address.toString(16)}.`).toBe(expectedAddress);
                
                const rnValue = cpu.getGeneralRegister(rn);
                if (expectedRnUpdate !== undefined) {
                    expect(
                        rnValue,
                        `Line ${i.lineNumber}: Expected R1 to be updated to 0x${expectedRnUpdate.toString(16)} but got 0x${(rnValue >>> 0).toString(16)}.`
                    ).toBe(expectedRnUpdate);
                } else {
                    expect(
                        rnValue,
                        `Line ${i.lineNumber}: Expected R1 to be unchanged from 0x${previousRnValue.toString(16)} but got 0x${(rnValue >>> 0).toString(16)}.`
                    ).toBe(previousRnValue);
                }
            }
        });

});

test('Determine load/store addresses (addressing modes 3)', () => {
    fail(`Not implemented`);
});

test("Execute data processing ARM instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/data_processing_arm.txt", processARM)
});

test("Execute branch ARM instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/branch_arm.txt", processARM);
});

test("Execute multiply ARM instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/multiply_arm.txt", processARM);
})

test("Execute status register access ARM instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/status_register_access_arm.txt", processARM);
});

test("Execute semaphore ARM instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/semaphore_arm.txt", processARM);
});
