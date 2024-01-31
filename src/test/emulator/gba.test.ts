import { readFileSync } from "fs";
import { GBA } from "../../emulator/gba";


const executeROM = (romPath: string, frames: number) => {
    const gba = new GBA();
    gba.cpu.bootBIOS = false;
    gba.reset();

    const rom = new Uint8Array(readFileSync(romPath));
    gba.loadROM(rom);
    gba.status = 'running';
    const start = performance.now();
    for (let i = 0; i < frames; i++) {
        gba.runFrame();
    }
    const elapsedMS = performance.now() - start;
    gba.display.saveToFile();

    const cyclesPerSecond = gba.cycles / elapsedMS * 1000;
    const mHz = cyclesPerSecond / 1000000;

    console.log(`cpu cycles = ${gba.cycles}, ${elapsedMS} ms, ${mHz} mHz`);
    console.log(gba.cpu.profiler);
    console.log(`${gba.cpu.profiler.instructionTimings.total / gba.cpu.profiler.instructionTimings.count} ms per instruction`);
}

test('three_squares', () => {
    const filePath = "src/test/emulator/data/roms/three_squares.gba";
    const frames = 2;
    executeROM(filePath, frames);
});


test('mode 3 lines', () => {
    const filePath = "src/test/emulator/data/roms/mode_3_lines.gba";
    const frames = 3;
    executeROM(filePath, frames);
});
