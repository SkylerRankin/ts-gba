import { CPU, Reg } from "./cpu";
import { CanvasDisplay, Display } from "./display";
import { Keypad } from "./keypad";
import { Memory } from "./memory";
import { PPU } from "./ppu";
import { UI } from "./ui";

interface GBAType {
    loadROM(rom: Uint8Array) : void;
    run() : void;
    pause() : void;
    reset() : void;
}

type GBAStatus = 'running' | 'paused';


class GBA implements GBAType {
    status: GBAStatus = 'paused';
    cycles: number = 0;
    memory: Memory;
    display: Display;
    cpu: CPU;
    ppu: PPU;
    keypad: Keypad;
    nextFrameTimer: number = 0;
    frameQueue: number[] = [];

    constructor(display: Display = new CanvasDisplay()) {
        this.memory = new Memory();
        this.cpu = new CPU(this.memory);
        this.display = display;
        this.ppu = new PPU(this.memory, this.display);
        this.keypad = new Keypad(this.memory);
        this.frameQueue = new Array<number>();
    }

    loadROM(rom: Uint8Array) {
        this.memory.loadROM(rom);
    }

    run() {
        this.status = 'running';
        this.runFrame();
    }

    runStep() {
        this.cpu.step();
        this.ppu.step(this.cycles);
        this.cycles += 1;
    }

    runFrame() {
        const frameStart = performance.now();
        const cyclesStart = this.cycles;
        while (true) {
            this.runStep();
            if (this.cpu.atBreakpoint()) {
                this.pause();
                this.cpu.breakpointCallback();
                break;
            }
            if (this.ppu.vBlankAck) {
                this.ppu.vBlankAck = false;
                break;
            }
        }
        const frameTime = performance.now() - frameStart;
        this.frameQueue.push(frameTime);

        if (this.frameQueue.length > 100) {
            this.frameQueue.splice(0, 1);
        }

        const average = this.frameQueue.reduce((a, b) => a + b, 0) / this.frameQueue.length;
        console.log(`Average frame time: ${average.toFixed(2)} ms, fps = ${(1000 / average).toFixed(2)}, cycles = ${this.cycles - cyclesStart}`);

        if (this.status === 'running') {
            // Doesn't seem to work in a node environment
            const frameDelay = Math.max(16 - frameTime, 16); // TODO: reduce the max delay to 1?
            this.nextFrameTimer = window.setTimeout(() => { this.runFrame(); }, frameDelay);
        }
    }

    pause() {
        this.status = 'paused';
        window.clearTimeout(this.nextFrameTimer);
    }

    reset() {
        this.status = 'paused';
        this.cycles = 0;
        window.clearTimeout(this.nextFrameTimer);

        this.memory.reset();
        this.cpu.reset();
        this.ppu.reset();
        this.keypad.reset();
        this.display.reset();
    }

}

// Define the GBA class on window for use in frontend.
(window as any).GBA = GBA;
// Define the UI class on window for use in frontend.
(window as any).UI = UI;

export { GBA }
export { GBAType }
