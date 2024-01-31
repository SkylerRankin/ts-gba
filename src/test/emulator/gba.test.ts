import { readFileSync } from "fs";
import { GBA } from "../../emulator/gba";


test('three_squares', () => {
    const gba = new GBA();
    gba.cpu.bootBIOS = false;
    gba.reset();

    const filePath = "src/test/emulator/data/roms/three_squares.gba";
    const rom = new Uint8Array(readFileSync(filePath));

    gba.loadROM(rom);
    gba.status = 'running';
    const start = performance.now();
    for (let i = 0; i < 2; i++) {
        gba.runFrame();
    }
    const elapsedMS = performance.now() - start;
    gba.display.saveToFile();
    gba.cpu.history.saveToFile();

    const cyclesPerSecond = gba.cycles / elapsedMS * 1000;
    const mHz = cyclesPerSecond / 1000000;

    console.log(`cpu cycles = ${gba.cycles}, ${elapsedMS} ms, ${mHz} mHz`);
    console.log(gba.cpu.profiler);
    console.log(`${gba.cpu.profiler.instructionTimings.total / gba.cpu.profiler.instructionTimings.count} ms per instruction`);
});
