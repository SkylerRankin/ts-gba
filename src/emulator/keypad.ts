import { CPU } from "./cpu";
import { requestInterrupt } from "./interrupt";
import { getCachedIORegister } from "./ioCache";
import { int16ToByteArray } from "./math";
import { Memory } from "./memory";

type Key = "A" | "B" | "Select" | "Start" | "Right" | "Left" | "Up" | "Down" | "R" | "L";
const KeyOffset: {[key in Key]: number} = {
    A: 0,
    B: 1,
    Select: 2,
    Start: 3,
    Right: 4,
    Left: 5,
    Up: 6,
    Down: 7,
    R: 8,
    L: 9
};

const KeyInputRegister = 0x04000130;
const KeyInterruptRegister = 0x04000132;

class Keypad {
    cpu: CPU;
    pressedKeys: Set<number>;

    constructor(cpu: CPU) {
        this.cpu = cpu;
        this.reset();
        this.pressedKeys = new Set();
    }

    onKeyDown(key: Key) {
        let keyInput = getCachedIORegister(KeyInputRegister);
        const offset = KeyOffset[key];
        keyInput &= ~(1 << offset);
        this.cpu.memory.setInt16(KeyInputRegister, keyInput, false, true);
        this.pressedKeys.add(offset);

        const interruptControl = getCachedIORegister(KeyInterruptRegister);
        const keyInterruptEnabled = (interruptControl & 0x2000) > 0;
        if (keyInterruptEnabled) {
            const andCondition = (interruptControl & 0x4000) > 0;
            if (andCondition) {
                // (AND) All keys in register must be pressed
                let conditionMet = true;
                for (let i = 0; i <= 9; i++) {
                    const keyEnabled = ((interruptControl >> i) & 0x1) === 1;
                    const keyPressed = this.pressedKeys.has(i);
                    if (keyEnabled && !keyPressed) {
                        conditionMet = false;
                        break;
                    }
                }
                if (conditionMet) {
                    requestInterrupt(this.cpu, "Keypad");
                }
            } else {
                // (OR) Any key in register can be pressed
                if ((interruptControl >> offset) & 0x1) {
                    requestInterrupt(this.cpu, "Keypad");
                }
            }
        }
    }

    onKeyUp(key: Key) {
        let keyInput = getCachedIORegister(KeyInputRegister);
        keyInput |= (1 << KeyOffset[key]);
        this.cpu.memory.setInt16(KeyInputRegister, keyInput, false, true);
        this.pressedKeys.delete(KeyOffset[key]);
    }

    reset() {
        // Sets all keys to released, KEYINPUT = 0x03FF
        this.cpu.memory.setInt16(KeyInputRegister, 0x03FF, false, true);
    }

}

export { Keypad }
