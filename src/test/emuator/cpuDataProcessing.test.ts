import { CPU, Reg } from "../../emulator/cpu";
import { createStateString } from '../../emulator/cpuStateString';

// Testing the data processing instructions.

const cpu = new CPU();

test('ARM: ADD, SUB', () => {
    const program = [
        0xe2, 0x80, 0x00, 0x01, // ADD R0, R0, #1
        0xe2, 0x81, 0x1b, 0x01, // ADD R1, R1, #1024
        0xe0, 0x80, 0x20, 0x01, // ADD R2, R0, R1
        0xe0, 0x82, 0x30, 0x11, // ADD R3, R2, R1, LSL R0
        0xe0, 0x40, 0x00, 0x00, // SUB R0, R0, R0
        0xe2, 0x40, 0x00, 0x0d, // SUB R0, R0, #13
        0xe0, 0x80, 0x40, 0x01, // ADD R4, R0, R1
        0xe0, 0x44, 0x54, 0x41, // SUB R5, R4, R1, ASR #8
        0xe0, 0x85, 0x08, 0xe2, // ADD R0, R5, R2, ROR #17
        0xe0, 0x40, 0x63, 0x31  // SUB R6, R0, R1, LSR R3
    ];
    const stateString = createStateString().setMode('usr').setState('ARM');
    const stateStrings = [
        stateString.setRegister(0, 1).setRegister(Reg.PC, 0xC).build(),
        stateString.setRegister(1, 1024).setRegister(Reg.PC, 0x10).build(),
        stateString.setRegister(2, 1025).setRegister(Reg.PC, 0xC + (4 * 2)).build(),
        stateString.setRegister(3, 3073).setRegister(Reg.PC, 0xC + (4 * 3)).build(),
        stateString.setRegister(0, 0).setRegister(Reg.PC, 0xC + (4 * 4)).build(),
        stateString.setRegister(0, -13).setRegister(Reg.PC, 0xC + (4 * 5)).build(),
        stateString.setRegister(4, 1011).setRegister(Reg.PC, 0xC + (4 * 6)).build(),
        stateString.setRegister(5, 1007).setRegister(Reg.PC, 0xC + (4 * 7)).build(),
        stateString.setRegister(0, 0x020083EF).setRegister(Reg.PC, 0xC + (4 * 8)).build(),
        stateString.setRegister(6, 0x020083EF).setRegister(Reg.PC, 0xC + (4 * 9)).build(),
    ];
    cpu.reset();
    cpu.loadProgram(program);
    for (let i = 0; i < stateStrings.length; i++) {
        cpu.step();
        expect(cpu.getStateString()).toBe(stateStrings[i]);
    }
    expect(1).toBe(1);
});
