import { CPU, Reg } from "../../emulator/cpu";
import { createStateString } from '../../emulator/cpuStateString';

const cpu = new CPU();

test('Check instruction type decodings', () => {
    const program = [
        0xe2, 0xa2, 0x10, 0x01, // ADC R1, R2, #1
        0xe2, 0x81, 0x00, 0x0a, // ADD R0, R1, #10
        0xe2, 0x07, 0x0f, 0xe6, // AND R0, R7, #920
        0xea, 0x00, 0x02, 0xfe, // B #0x0C00
        0xe1, 0xc1, 0x00, 0x02, // BIC R0, R1, R2
        0xe1, 0x20, 0x06, 0x74, // BKPT #100
        0xfa, 0xff, 0xff, 0xfe, // BLX #1
        0xe1, 0x2f, 0xff, 0x31, // BLX R1
        0xe1, 0x2f, 0xff, 0x14, // BX R4
        // CDP
        0xe1, 0x6f, 0x0f, 0x11, // CLZ R0, R1
        0xe3, 0x71, 0x00, 0x01, // CMN R1, #1
        0xe3, 0x51, 0x00, 0x01, // CMP R1, #1
        0xe0, 0x22, 0x10, 0x03, // EOR R1, R2, R3
        // LDC
        0xe8, 0x90, 0x00, 0x0e, // LDM (1) : LDMIA R0, {R1, R2, R3}
        0xe8, 0xd0, 0x00, 0x0e, // LDM (2) : LDMIA R0, {R1, R2, R3}^
        // LDM (3)
        0xe5, 0x91, 0x00, 0x01, // LDR R0, [R1, #1]
        0xe5, 0xd1, 0x00, 0x01, // LDRB R0, [R1, #1]
        0xe4, 0xf1, 0x00, 0x02, // LDRBT R0, [R1], #2
        0xe1, 0xd1, 0x00, 0xb7, // LDRH R0, [R1, #7]
        0xe1, 0xd2, 0x50, 0xd3, // LDRSB R5, [R2, #3]
        0xe1, 0xd0, 0x30, 0xf1, // LDRSH R3, [R0, #1]
        0xe4, 0xb3, 0x00, 0x0a, // LDRT R0, [R3], #10
        // MCR
        0xe0, 0x20, 0x32, 0x91, // MLA R0, R1, R2, R3
        0xe3, 0xa0, 0x00, 0x01, // MOV R0, #1
        // MRC
        0xe1, 0x0f, 0x00, 0x00, // MRS R0, CPSR
        0xe3, 0x23, 0xf0, 0x0a, // MSR CPSR_cx, #10
        0xe0, 0x00, 0x02, 0x91, // MUL R0, R1, R2
        0xe3, 0xe0, 0x00, 0x14, // MVN R0, #20
        0xe1, 0x84, 0x10, 0x05, // ORR R1, R4, R5
        0xe0, 0x62, 0x10, 0x03, // RSB R1, R2, R3
        0xe0, 0xe2, 0x10, 0x03, // RSC R1, R2, R3
        0xe0, 0xc1, 0x00, 0x07, // SBC R0, R1, R7
        0xe0, 0xe2, 0x16, 0x95, // SMLAL R1, R2, R5, R6
        0xe0, 0xc5, 0x43, 0x92, // SMULL R4, R5, R2, R3
        // STC
        0xe8, 0x80, 0x00, 0x12, // STM (1) : STMIA R0, {R1, R4}
        0xe8, 0xc0, 0x00, 0x12, // STM (2) : STMIA R0, {R1, R4}^
        0xe5, 0x83, 0x00, 0x01, // STR R0, [R3, #1]
        0xe5, 0xc3, 0x00, 0x01, // STRB R0, [R3, #1]
        0xe4, 0xe4, 0x00, 0x80, // STRBT R0, [R4], #128
        0xe1, 0xc4, 0x71, 0xb0, // STRH R7, [R4, #16]
        0xe4, 0xa8, 0x01, 0x00, // STRT R0, [R8], #256
        0xe0, 0x44, 0x00, 0x02, // SUB R0, R4, R2
        0xef, 0x00, 0x04, 0x08, // SWI #1032
        0xe1, 0x03, 0x00, 0x91, // SWP R0, R1, [R3]
        0xe1, 0x43, 0x00, 0x91, // SWPB R0, R1, [R3]
        0xe1, 0x30, 0x00, 0x01, // TEQ R0, R1
        0xe1, 0x10, 0x00, 0x01, // TST R0, R1
        0xe0, 0xa1, 0x08, 0x97, // UMLAL R0, R1, R7, R8
        0xe0, 0x81, 0x08, 0x97, // UMULL R0, R1, R7, R8
    ];
    const expectedHistory = [
        'ADC', 'ADD', 'AND',
        'BBL', 'BIC', 'BKPT', 'BLX (1)', 'BLX (2)', 'BX',
        /*'CDP',*/ 'CLZ', 'CMN', 'CMP',
        'EOR',
        /*'LDC',*/ 'LDM (1)', 'LDM (2)', /*'LDM (3)',*/ 'LDR', 'LDRB', 'LDRBT', 'LDRH', 'LDRSB', 'LDRSH', 'LDRT',
        /*'MCR',*/ 'MLA', 'MOV', /*'MRC',*/ 'MRS', 'MSR', 'MUL', 'MVN',
        'ORR',
        'RSB', 'RSC',
        'SBC', 'SMLAL', 'SMULL', /*'STC',*/ 'STM (1)', 'STM (2)', 'STR', 'STRB', 'STRBT', 'STRH', 'STRT', 'SUB', 'SWI', 'SWP', 'SWPB',
        'TEQ', 'TST',
        'UMLAL', 'UMULL'
    ];
    cpu.reset();
    cpu.loadProgram(program);
    for (let i = 0; i < program.length / 4; i++) {
        cpu.step();
    }
    expect(cpu.history.toString()).toBe(expectedHistory.toString());
});

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
});
