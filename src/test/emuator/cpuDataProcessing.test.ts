import { CPU, Reg } from "../../emulator/cpu";
import { createStateString } from '../../emulator/cpuStateString';
import { byteArrayToInt32 } from '../../emulator/math';

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
        stateString.setRegister(0, 1).setRegister(Reg.PC, 0x0800000C).build(),
        stateString.setRegister(1, 1024).setRegister(Reg.PC, 0x08000010).build(),
        stateString.setRegister(2, 1025).setRegister(Reg.PC, 0x0800000C + (4 * 2)).build(),
        stateString.setRegister(3, 3073).setRegister(Reg.PC, 0x0800000C + (4 * 3)).build(),
        stateString.setRegister(0, 0).setRegister(Reg.PC, 0x0800000C + (4 * 4)).build(),
        stateString.setRegister(0, -13).setRegister(Reg.PC, 0x0800000C + (4 * 5)).build(),
        stateString.setRegister(4, 1011).setRegister(Reg.PC, 0x0800000C + (4 * 6)).build(),
        stateString.setRegister(5, 1007).setRegister(Reg.PC, 0x0800000C + (4 * 7)).build(),
        stateString.setRegister(0, 0x020083EF).setRegister(Reg.PC, 0x0800000C + (4 * 8)).build(),
        stateString.setRegister(6, 0x020083EF).setRegister(Reg.PC, 0x0800000C + (4 * 9)).build(),
    ];
    cpu.reset();
    cpu.loadProgram(program);
    for (let i = 0; i < stateStrings.length; i++) {
        cpu.step();
        expect(cpu.getStateString()).toBe(stateStrings[i]);
    }
});

test('ARM: STM', () => {
    const program = [
        0xe8, 0x80, 0x00, 0x0e, // STMIA R0, {R1, R2, R3}
        0xe8, 0xa0, 0x00, 0x70, // STMIA R0!, {R4, R5, R6}
    ];

    cpu.reset();
    cpu.setGeneralRegister(0, 0x10);
    for (let i = 0; i < 10; i++) {
        cpu.setGeneralRegister(i, i);
    }
    cpu.setGeneralRegister(0, 0x10);
    cpu.loadProgram(program);
    cpu.step();
    expect(cpu.getGeneralRegister(0)).toBe(0x10);
    expect(byteArrayToInt32(cpu.getBytesFromMemory(0x10, 4), cpu.bigEndian)).toBe(1);
    expect(byteArrayToInt32(cpu.getBytesFromMemory(0x14, 4), cpu.bigEndian)).toBe(2);
    expect(byteArrayToInt32(cpu.getBytesFromMemory(0x18, 4), cpu.bigEndian)).toBe(3);

    cpu.setGeneralRegister(0, 0x20);
    cpu.step();
    expect(cpu.getGeneralRegister(0)).toBe(0x2C);
    expect(byteArrayToInt32(cpu.getBytesFromMemory(0x20, 4), cpu.bigEndian)).toBe(4);
    expect(byteArrayToInt32(cpu.getBytesFromMemory(0x24, 4), cpu.bigEndian)).toBe(5);
    expect(byteArrayToInt32(cpu.getBytesFromMemory(0x28, 4), cpu.bigEndian)).toBe(6);

})
