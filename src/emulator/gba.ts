import { CPU } from "./cpu";
import { CanvasDisplay, Display } from "./display";
import { executeDMAs } from "./dma";
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
    memory: Memory;
    display: Display;
    cpu: CPU;
    ppu: PPU;
    keypad: Keypad;
    nextFrameTimer: number = 0;
    previousFrameStart: number = 0;
    frameQueue: number[] = [];

    constructor(display: Display = new CanvasDisplay()) {
        this.memory = new Memory();
        this.cpu = new CPU(this.memory);
        this.display = display;
        this.ppu = new PPU(this.cpu, this.display);
        this.keypad = new Keypad(this.cpu);
        this.frameQueue = new Array<number>();
    }

    loadROM(rom: Uint8Array) {
        this.memory.loadROM(rom);
    }

    loadBIOS(bios: Uint8Array) {
        this.memory.loadBIOS(bios);
    }

    run() {
        this.status = 'running';
        this.runFrame();
    }

    runStep() {
        this.cpu.step();
        this.ppu.step(this.cpu.cycles);
        executeDMAs(this.cpu, this.ppu.stepFlags);
    }

    runFrame() {
        const frameStart = performance.now();
        const frameTime = frameStart - this.previousFrameStart;
        this.previousFrameStart = frameStart;

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
        this.frameQueue.push(frameTime);

        if (this.frameQueue.length > 100) {
            this.frameQueue.splice(0, 1);
        }

        if (this.status === 'running') {
            const frameDelay = Math.max(16 - frameTime, 5);
            this.nextFrameTimer = window.setTimeout(() => { this.runFrame(); }, frameDelay);
        }
    }

    pause() {
        this.status = 'paused';
        window.clearTimeout(this.nextFrameTimer);
    }

    reset() {
        this.status = 'paused';
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
