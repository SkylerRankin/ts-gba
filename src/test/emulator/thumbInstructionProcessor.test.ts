import { processTHUMB } from "../../emulator/thumbInstructionProcessors";
import { CPU } from "../../emulator/cpu";
import { readFileSync } from "fs";
import { toBigEndianInt16 } from "../../emulator/math";
import { executeInstructionTestFile } from "./test_utilities";


test("Identify THUMB op-codes", () => {
    const cpu = new CPU();

    const test_cases = readFileSync("src/test/emulator/data/opcodes_thumb.txt").toString()
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
    executeInstructionTestFile("src/test/emulator/data/data_processing_thumb.txt", processTHUMB)
});

test("Execute branch THUMB instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/branch_thumb.txt", processTHUMB);
});

test("Execute load/store THUMB instructions", () => {
    executeInstructionTestFile("src/test/emulator/data/load_store_thumb.txt", processTHUMB);
});
