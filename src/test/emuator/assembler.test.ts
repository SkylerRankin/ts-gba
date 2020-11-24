import { assembleInstruction } from '../../emulator/assembler';

test('assemble ADD', () => {
    expect(assembleInstruction('add r0, r1, #10')).toBe(3800104970);
    expect(assembleInstruction('addeqs r2, r7, #2684354564')).toBe(43459146);
    expect(assembleInstruction('addne r1, r2, #0x12C00')).toBe(310516555);
    expect(assembleInstruction('addls r1, r2, #0xA')).toBe(2457997322);
});

test('assemble B/BL', () => {
    expect(assembleInstruction('b #256')).toBe(0xea00003e);
    expect(assembleInstruction('bl #2')).toBe(0xebfffffe);
    expect(assembleInstruction('beq #0xFF0')).toBe(0x0a0003fa);
    expect(assembleInstruction('bgt #0xC000')).toBe(0xca002ffe);
    expect(assembleInstruction('bllt #0xB040')).toBe(0xbb002c0e);
});

test('assemble SUB', () => {
    expect(assembleInstruction('sub r0, r1, #10')).toBe(3795910666);
    expect(assembleInstruction('subeq r2, r7, #2684354564')).toBe(38216266);
    expect(assembleInstruction('subne r1, r2, #0x12C00')).toBe(306322251);
    expect(assembleInstruction('subls r1, r2, #0xA')).toBe(2453803018);
});

test('assemble MUL', () => {
    expect(assembleInstruction('mul r0, r1, r2')).toBe(3758097041);
    expect(assembleInstruction('muls r2, r7, r0')).toBe(3759276183);
    expect(assembleInstruction('mulvs r1, r2, r2')).toBe(1610678930);
    expect(assembleInstruction('mulhi r1, r2, r1')).toBe(2147549586);
});
