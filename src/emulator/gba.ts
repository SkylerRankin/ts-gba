import { CPU } from "./cpu";
import { Memory } from "./memory";
import { PPU } from "./ppu";

interface GBAType {
    run() : void;
    pause() : void;
    reset() : void;
}


type GBAStatus = 'running' | 'paused';


class GBA implements GBAType {

    status: GBAStatus = 'paused';
    cycles: number = 0;
    memory: Memory = new Memory();
    cpu: CPU = new CPU(this.memory);
    ppu: PPU = new PPU(this.memory);

    run() {
        this.status = 'running';
        setTimeout(this.runFrame, 16);
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
            setTimeout(this.runFrame, 16);
        }
    }

    pause() {
        this.status = 'paused';
    }

    reset() {
        // TODO
    }

}

export { GBA }
export { GBAType }
