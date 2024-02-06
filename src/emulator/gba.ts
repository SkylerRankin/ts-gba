import { CPU } from "./cpu";
import { Display } from "./display";
import { Memory } from "./memory";
import { PPU } from "./ppu";

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
    memory: Memory = new Memory();
    display: Display = new Display();
    cpu: CPU = new CPU(this.memory);
    ppu: PPU = new PPU(this.memory, this.display);

    loadROM(rom: Uint8Array) {
        this.memory.loadROM(rom);
    }

    run() {
        this.status = 'running';
        this.runFrame();
    }

    runFrame() {
        while (true) {
            this.cpu.step();
            this.ppu.step(this.cycles);
            this.cycles += 1;

            if (this.ppu.vBlankAck) {
                this.ppu.vBlankAck = false;
                break;
            }
        }

        if (this.status === 'running') {
            // Doesn't seem to work in a node environment
            // setTimeout(this.runFrame, 16);
        }
    }

    pause() {
        this.status = 'paused';
    }

    reset() {
        this.status = 'paused';
        this.cycles = 0;

        this.memory.reset();
        this.cpu.reset();
        this.ppu.reset();
        this.display.reset();
    }

}

export { GBA }
export { GBAType }
