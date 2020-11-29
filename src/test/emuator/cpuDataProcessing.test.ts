import { CPU, Reg } from "../../emulator/cpu";
import { createStateString } from '../../emulator/cpuStateString';

// Testing the data processing instructions.

const cpu = new CPU();

test('ARM: ADD, SUB', () => {
    const program = [
        0xe2800001, // ADD R0, R0, #1
        0xe2811b01, // ADD R1, R1, #1024
        0xe0802001, // ADD R2, R0, R1
        0xe0823011, // ADD R3, R2, R1, LSL R0
        0xe0400000, // SUB R0, R0, R0
        0xe240000d, // SUB R0, R0, #13
        0xe0804001, // ADD R4, R0, R1
        0xe0445441, // SUB R5, R4, R1, ASR #8
        0xe08508e2, // ADD R0, R5, R2, ROR #17
        0xe0406331  // SUB R6, R0, R1, LSR R3
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
