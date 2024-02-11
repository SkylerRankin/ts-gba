import { readFileSync } from "fs";
import { GBA } from "./gba";

const arrayMin = (a: any[]) => a.reduce((c, p) => c < p ? c : p, a[0]);
const arrayMax = (a: any[]) => a.reduce((c, p) => c > p ? c : p, a[0]);
const arraySum = (a: any[]) => a.reduce((c, p) => c + p, BigInt(0));


const executeROM = (romPath: string, frames: number) => {
    const gba = new GBA();
    gba.cpu.bootBIOS = false;
    gba.reset();

    const rom = new Uint8Array(readFileSync(romPath));
    gba.loadROM(rom);
    gba.status = 'running';
    const start = process.hrtime.bigint();
    const frameTimes = [];
    const cyclesPerFrame = [];

    for (let i = 0; i < frames; i++) {
        const frameStart = process.hrtime.bigint();
        const cyclesStart = gba.cycles;
        gba.runFrame();
        frameTimes.push(process.hrtime.bigint() - frameStart);
        cyclesPerFrame.push(BigInt(gba.cycles) - BigInt(cyclesStart));
    }
    const elapsedNS = process.hrtime.bigint() - start;
    gba.display.saveToFile();

    const cyclesPerSecond = BigInt(gba.cycles) / elapsedNS * BigInt(1e9);
    const mHz = cyclesPerSecond / BigInt(1e6);

    console.log(`cpu cycles = ${gba.cycles}, ${elapsedNS} ns, ${mHz} mHz`);
    console.log(gba.cpu.profiler);
    console.log(`${gba.cpu.profiler.instructionTimings.total / gba.cpu.profiler.instructionTimings.count} ns per instruction`);

    console.log(`avg frame time = ${arraySum(frameTimes) / BigInt(frameTimes.length)} ns`);
    console.log(`max frame time = ${arrayMax(frameTimes)} ns`);
    console.log(`min frame time = ${arrayMin(frameTimes)} ns`);

    console.log(`avg cycles per frame = ${arraySum(cyclesPerFrame) / BigInt(cyclesPerFrame.length)}`);
    console.log(`max cycles per frame = ${arrayMax(cyclesPerFrame)}`);
    console.log(`min cycles per frame = ${arrayMin(cyclesPerFrame)}`);
}

const run = () => {
    const filePath = "test/emulator/data/roms/mode_3_lines.gba";
    const frames = 100;
    executeROM(filePath, frames);
}

run();
