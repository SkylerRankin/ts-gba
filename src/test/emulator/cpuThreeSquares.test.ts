import { CPU, Reg } from '../../emulator/cpu';
import { createStateString } from '../../emulator/cpuStateString';
import { threeSquaresROM } from './data/threeSquares';

const cpu = new CPU();

test('ThreeSquares program', () => {

    const expectedInstructions = [
        // ARM
        'BBL', 'BBL', 'MOV', 'STR', 'MOV', 'MSR', 'LDR', 'ADD', 'BX',
        'LDR', 'LSL', 'B', 'MOV', 'LSL', 'B', 'MOV', 'LSL', 'LDR',
        'SUB', 'ADD', 'LSL', 'BBL',
        // THUMB
        ''
    ];

    cpu.reset();
    cpu.loadProgram(threeSquaresROM);
    cpu.step();
    expect(cpu.history.logs[0].instructionName).toBe('BBL');
    expect(cpu.getGeneralRegister(Reg.PC)).toBe(0x080000C0 + 8);
    
    for (let i = 0; i < 12; i++) {
        cpu.step();
    }

    for (let i = 0; i < cpu.history.logs.length; i++) {
        // console.log(cpu.history.toString(i));
    }
});
