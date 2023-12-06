import { processARM } from "../../emulator/armInstructionProcessors";
import { CPU } from "../../emulator/cpu";
import { readFileSync } from "fs";
import { toBigEndianInt32 } from "../../emulator/math";


test("Identify ARM op-codes", () => {
    const cpu = new CPU();

    const test_cases = readFileSync("src/test/emulator/data/opcodes.txt").toString()
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
