import { CPU, Reg } from "../../emulator/cpu";
import { createStateString } from '../../emulator/cpuStateString';

const cpu = new CPU();

test('CPU state strings', () => {
    let expected = createStateString()
        .setMode('sys')
        .setState('ARM')
        .setNZCV(0b1111)
        .setRegister(0, 0xFF)
        .setRegister(15, 0xC000)
        .build();
    
    cpu.setStateBit(0);
    cpu.setModeBits(0b11011);
    cpu.updateStatusRegister(['n', 'z', 'c', 'v']);
    cpu.updateGeneralRegister(0, 0xFF);
    cpu.updateGeneralRegister(Reg.PC, 0xC000);
    let actual = cpu.getStateString();
    expect(actual).toBe(expected);

    cpu.reset();

    expected = createStateString()
        .setMode('usr')
        .setState('THUMB')
        .setNZCV(0b0100)
        .setRegister(0, 0x1F)
        .setRegister(10, 0x999)
        .setRegister(4, 0xC01)
        .setRegister(Reg.PC, 0x8)
        .build();

    cpu.setStateBit(1);
    cpu.setConditionCodeFlags('z');
    cpu.setModeBits(0b10000);
    cpu.updateGeneralRegister(0, 0x1F);
    cpu.updateGeneralRegister(10, 0x999);
    cpu.updateGeneralRegister(4, 0xC01);

    actual = cpu.getStateString();
    expect(actual).toBe(expected);

});
