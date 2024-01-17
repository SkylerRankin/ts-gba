import { existsSync, readFileSync } from "fs";
import { CPU } from "../../emulator/cpu";
import { MemorySegments } from "../../emulator/memory";

test('Load and run the GBA BIOS', () => {
    const biosPath = "src/test/emulator/data/gba_bios.bin";
    expect(existsSync(biosPath)).toBeTruthy();
    const biosBuffer = readFileSync(biosPath);

    const expectedInstructions = [
        0xEA000018,
        0xE35E0000,
        0x03A0E004,
        0xE3A0C301,
        0xE5DCC300,
        0xE33C0001,
        0x010FC000,
        0x038CC0C0,
        0x0129F00C,
        0x0AFFFFE3,
        0xE3A000DF,
        0xE129F000,
        0xE3A04301,
        0xE5C44208,
        0xEB00000F,
        0xE3A000D3,
        0xE129F000,
        0xE59FD0D0,
        0xE3A0E000,
        0xE169F00E
    ];

    const cpu = new CPU();
    cpu.memory.setBytes(MemorySegments.BIOS.start, biosBuffer);

    const steps = expectedInstructions.length;
    for (let i = 0; i < steps; i++) {
        cpu.step();
        const instruction = cpu.history.currentLog.instruction;
        // console.log(cpu.history.currentLog);
        // console.log(cpu.getStateSummary());
        // console.log(cpu.history.currentLog);
        expect(instruction).toBe(expectedInstructions[i]);
    }    

    // console.log(cpu.getStateSummary());

});
