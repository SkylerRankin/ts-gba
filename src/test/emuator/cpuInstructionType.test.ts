import { CPU, Reg } from "../../emulator/cpu";

const cpu = new CPU();

test('Check ARM instruction type decodings', () => {
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
    cpu.bigEndian = true;
    cpu.loadProgram(program);

    // Set PC manually to prevent branches from jumping around.
    let pc = 0x08000008;
    for (let i = 0; i < program.length / 4; i++) {
        cpu.step();
        pc += 4;
        cpu.setGeneralRegister(Reg.PC, pc);
    }

    for (let i = 0; i < expectedHistory.length; i++) {
        expect(cpu.history.logs[i].instructionName).toBe(expectedHistory[i]);
    }
});

test('Check THUMB instruction type decodings', () => {
    const program = [
        0x41, 0x48, // ADC R0, R1
        0x1c, 0x87, // ADD R0, R3, #2
        0x30, 0x12, // ADD R0, #18
        0x18, 0x60, // ADD R0, R4, R1
        0x44, 0x28, // ADD R0, R5
        0xA1, 0x88, // ADD R1, PC, #136
        0xA9, 0x88, // ADD R1, SP, #136 * 4
        0xB0, 0x01, // ADD SP, #1 * 4
        0x40, 0x0A, // AND R1, R2
        0x13, 0x17, // ASR R7, R2, #12
        0x41, 0x0A, // ASR R2, R1
        0xDE, 0x80, // B #0x80,
        0xE1, 0x00, // B #0x100
        0x43, 0x89, // BIC R1, R1
        0xBE, 0x01, // BKPT #1
        0xF8, 0x01, // BLX #1
        0x47, 0xC8, // BLX R1
        0x47, 0x48, // BX R1
        0x42, 0xCA, // CMN R2, R1
        0x29, 0x80, // CMP R1, #0x80
        0x42, 0x8A, // CMP R2, R1
        0x45, 0xCA, // CMP R2, R1
        0x40, 0x7F, // EOR R7, R7
        0xCF, 0x06, // LDMIA R7!, {1, 2}
        0x68, 0x3F, // LDR R7, [R7, #0 * 4]
        0x59, 0xF6, // LDR R6, [R6, R7]
        0x4F, 0x80, // LDR R7, [PC, #0x80 * 4]
        0x9F, 0x81, // LDR R7, [SP, #0x81 * 4]
        0x78, 0x7F, // LDRB R7, [R7, #1]
        0x5C, 0x53, // LDRB R3, [R2, R1]
        0x88, 0x7F, // LDRH R7, [R7, #1 * 2]
        0x5B, 0xF5, // LDRH R5, [R6, R7]
        0x57, 0xF8, // LDRSB R0, [R7, R7]
        0x5E, 0x01, // LDRSH R1, [R0, R0]
        0x00, 0x7F, // LSL R7, R7, #1
        0x40, 0xBF, // LSL R7, R7
        0x08, 0x52, // LSR R2, R2, #1
        0x40, 0xC1, // LSR R1, R0
        0x20, 0x01, // MOV R0, #1
        // MOV (2) is encoded as an add plus #0
        0x1C, 0x01, // MOV R1, R0
        0x46, 0xC1, // MOV R1, R0
        0x43, 0x61, // MUL R1, R4
        0x43, 0xC7, // MVN R7, R0
        0x42, 0x61, // NEG R1, R4
        0x43, 0x23, // ORR R3, R4
        0xBD, 0x08, // POP {3}
        0xB5, 0x01, // PUSH {0}
        0x41, 0xC7, // ROR R7, R0
        0x41, 0xB8, // SBC R0, R7
        0xC0, 0x01, // STMIA R0!, {0}
        0x60, 0x3F, // STR R7, [R7, #0 * 4]
        0x50, 0x0A, // STR R2, R1, R0
        0x90, 0x01, // STR R0, [SP, #1 * 4]
        0x72, 0x3F, // STRB R7, [R7, #8]
        0x55, 0xF9, // STRB R1, [R7, R7]
        0x80, 0x3A, // STRH R2, [R7, #0 * 2]
        0x52, 0x3A, // STRH R2, [R7, R0]
        0x1E, 0x12, // SUB R2, R2, #0
        0x3A, 0x00, // SUB R2, #0
        0x1A, 0x3E, // SUB R6, R7, R0
        0xB0, 0x81, // SUB SP, #1 * 4
        0xDF, 0x01, // SWI #1
        0x42, 0x3B, // TST R3, R7
    ];
    const expectedHistory = [
        'ADC', 'ADD (1)', 'ADD (2)', 'ADD (3)', 'ADD (4)', 'ADD (5)', 'ADD (6)', 'ADD (7)',
        'AND', 'ASR (1)', 'ASR (2)', 'B (1)', 'B (2)', 'BIC', 'BKPT', 'BL', 'BL', 'BX',
        'CMN', 'CMP (1)', 'CMP (2)', 'CMP (3)', 'EOR', 'LDMIA', 'LDR (1)', 'LDR (2)', 'LDR (3)',
        'LDR (4)', 'LDRB (1)', 'LDRB (2)', 'LDRH (1)', 'LDRH (2)', 'LDRSB', 'LDRSH', 'LSL (1)',
        'LSL (2)', 'LSR (1)', 'LSR (2)', 'MOV (1)', 'ADD (1)', 'MOV (3)', 'MUL', 'MVN', 'NEG',
        'ORR', 'POP', 'PUSH', 'ROR', 'SBC', 'STMIA', 'STR (1)', 'STR (2)', 'STR (3)', 'STRB (1)',
        'STRB (2)', 'STRH (1)', 'STRH (2)', 'SUB (1)', 'SUB (2)', 'SUB (3)', 'SUB (4)', 'SWI', 'TST'
    ];
    cpu.reset();
    cpu.operatingState = 'THUMB';
    cpu.bigEndian = true;
    cpu.loadProgram(program);

    // Set PC manually to prevent branches from jumping around.
    let pc = 0x08000008;
    for (let i = 0; i < program.length / 2; i++) {
        cpu.step();
        pc += 2;
        cpu.setGeneralRegister(Reg.PC, pc);
    }

    for (let i = 0; i < expectedHistory.length; i++) {
        expect(cpu.history.logs[i].instructionName).toBe(expectedHistory[i]);
    }
});
