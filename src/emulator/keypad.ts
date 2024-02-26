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

class Keypad {

    memory: Memory;

    constructor(memory: Memory) {
        this.memory = memory;
        this.reset();
    }

    onKeyDown(key: Key) {
        let keyInput = this.memory.getInt16(KeyInputRegister);
        keyInput &= ~(1 << KeyOffset[key]);
        this.memory.setBytes(KeyInputRegister, int16ToByteArray(keyInput, false));
    }

    onKeyUp(key: Key) {
        let keyInput = this.memory.getInt16(KeyInputRegister);
        keyInput |= (1 << KeyOffset[key]);
        this.memory.setBytes(KeyInputRegister, int16ToByteArray(keyInput, false));
    }

    reset() {
        // Sets all keys to released, KEYINPUT = 0x03FF
        this.memory.setBytes(KeyInputRegister, new Uint8Array([0xFF, 0x03]));
    }

}

export { Keypad }
