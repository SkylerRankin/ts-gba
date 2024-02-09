import { processTHUMB } from "../../src/emulator/thumbInstructionProcessors";
import { CPU } from "../../src/emulator/cpu";
import { readFileSync } from "fs";
import { toBigEndianInt16 } from "../../src/emulator/math";
import { executeInstructionTestFile } from "./test_utilities";
import { Memory } from "../../src/emulator/memory";


test("Identify THUMB op-codes", () => {
    const memory = new Memory();
    const cpu = new CPU(memory);

    const test_cases = readFileSync("test/emulator/data/opcodes_thumb.txt").toString()
        .split(/\r?\n/)
        .filter(line => !line.startsWith("#") && line.length > 0)
        .map(line => {
            const encoding = Number(line.substring(0, line.indexOf(" ")));
            const name = line.substring(line.indexOf("[") + 1, line.indexOf("]"));
            return { name, encoding };
        });

    test_cases.forEach(e => {
        const bigEndianEncoding = toBigEndianInt16(e.encoding);
        processTHUMB(cpu, bigEndianEncoding);
        expect(cpu.history.currentLog.instructionName).toBe(e.name);
    });
});

test("Execute data processing THUMB instructions", () => {
    executeInstructionTestFile("test/emulator/data/data_processing_thumb.txt", processTHUMB)
});

test("Execute branch THUMB instructions", () => {
    executeInstructionTestFile("test/emulator/data/branch_thumb.txt", processTHUMB);
});

test("Execute load/store THUMB instructions", () => {
    executeInstructionTestFile("test/emulator/data/load_store_thumb.txt", processTHUMB);
});

test("Execute load/store multiple THUMB instructions", () => {
    executeInstructionTestFile("test/emulator/data/load_store_multiple_thumb.txt", processTHUMB);
});
