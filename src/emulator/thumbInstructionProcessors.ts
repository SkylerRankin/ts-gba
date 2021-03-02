import { CPU, Reg } from './cpu';
import { ProcessedInstructionOptions } from './armInstructionProcessors';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight } from './math';

const processTHUMB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {

    const bits = (i >>> 0).toString(2).padStart(32, '0')
        .split('').map((x: string) : number => parseInt(x)).reverse();

    // Exception Generating Instructions
    if (i >>> 8 === 0b10111110) return processBKPT(cpu, i);
    if (i >>> 8 === 0b11011111) return processSWI(cpu, i);

    // Branch Instructions
    if ((i >>> 12 & 0xF) === 0b1101) return processB(cpu, i, 1);
    if ((i >>> 11 & 0x1F) === 0b11100) return processB(cpu, i, 2);
    if ((i >>> 13 & 0x7) === 0b111) return processBL_BLX1(cpu, i);
    if ((i >>> 7 & 0x1FF) === 0b010001110) return processBX(cpu, i);
    if ((i >>> 7 & 0x1FF) === 0b010001111) return processBLX2(cpu, i);

    // Data Processing Instructions
    if (i >>> 6 === 0b0100000101) return processADC(cpu, i);
    if (i >>> 9 === 0b0001110) return processADD(cpu, i, 1);
    if (i >>> 11 === 0b00110) return processADD(cpu, i, 2);
    if (i >>> 9 === 0b0001100) return processADD(cpu, i, 3);
    if (i >>> 8 === 0b01000100) return processADD(cpu, i, 4);
    if (i >>> 11 === 0b10100) return processADD(cpu, i, 5);
    if (i >>> 11 === 0b10101) return processADD(cpu, i, 6);
    if (i >>> 7 === 0b101100000) return processADD(cpu, i, 7);
    if (i >>> 6 === 0b0100000000) return processAND(cpu, i);
    if (i >>> 11 === 0b00010) return processASR(cpu, i, 1);
    if (i >>> 6 === 0b0100000100) return processASR(cpu, i, 2);
    if (i >>> 6 === 0b0100001110) return processBIC(cpu, i);
    if (i >>> 6 === 0b0100001011) return processCMN(cpu, i);
    if (i >>> 11 === 0b00101) return processCMP(cpu, i, 1);
    if (i >>> 6 === 0b0100001010) return processCMP(cpu, i, 2);
    if (i >>> 8 === 0b01000101) return processCMP(cpu, i, 3);
    if (i >>> 6 === 0b0100000001) return processEOR(cpu, i);
    if (i >>> 11 === 0b00000) return processLSL(cpu, i, 1);
    if (i >>> 6 === 0b0100000010) return processLSL(cpu, i, 2);
    if (i >>> 11 === 0b00001) return processLSR(cpu, i, 1);
    if (i >>> 6 === 0b0100000011) return processLSR(cpu, i, 2);
    if (i >>> 11 === 0b00100) return processMOV(cpu, i, 1);
    if (i >>> 6 === 0b0001110000) return processMOV(cpu, i, 2);
    if (i >>> 8 === 0b01000110) return processMOV(cpu, i, 3);
    if (i >>> 6 === 0b0100001101) return processMUL(cpu, i);
    if (i >>> 6 === 0b0100001111) return processMVN(cpu, i);
    if (i >>> 6 === 0b0100001001) return processNEG(cpu, i);
    if (i >>> 6 === 0b0100001100) return processORR(cpu, i);
    if (i >>> 6 === 0b0100000111) return processROR(cpu, i);
    if (i >>> 6 === 0b0100000110) return processSBC(cpu, i);
    if (i >>> 9 === 0b0001111) return processSUB(cpu, i, 1);
    if (i >>> 11 === 0b00111) return processSUB(cpu, i, 2);
    if (i >>> 9 === 0b0001101) return processSUB(cpu, i, 3);
    if (i >>> 7 === 0b101100001) return processSUB(cpu, i, 4);
    if (i >>> 6 === 0b0100001000) return processTST(cpu, i);

    // Load Store Instructions
    if (i >>> 11 === 0b01101) return processLDR(cpu, i, 1);
    if (i >>> 9 === 0b0101100) return processLDR(cpu, i, 2);
    if (i >>> 11 === 0b01001) return processLDR(cpu, i, 3);
    if (i >>> 11 === 0b10011) return processLDR(cpu, i, 4);
    if (i >>> 11 === 0b01111) return processLDRB(cpu, i, 1);
    if (i >>> 9 === 0b0101110) return processLDRB(cpu, i, 2);
    if (i >>> 11 === 0b10001) return processLDRH(cpu, i, 1);
    if (i >>> 9 === 0b0101101) return processLDRH(cpu, i, 2);
    if (i >>> 9 === 0b0101011) return processLDRSB(cpu, i);
    if (i >>> 9 === 0b0101111) return processLDRSH(cpu, i);
    if (i >>> 11 === 0b01100) return processSTR(cpu, i, 1);
    if (i >>> 9 === 0b0101000) return processSTR(cpu, i, 2);
    if (i >>> 11 === 0b10010) return processSTR(cpu, i, 3);
    if (i >>> 11 === 0b01110) return processSTRB(cpu, i, 1);
    if (i >>> 9 === 0b0101010) return processSTRB(cpu, i, 2);
    if (i >>> 11 === 0b10000) return processSTRH(cpu, i, 1);
    if (i >>> 9 === 0b0101001) return processSTRH(cpu, i, 2);

    // Load Store Multiple Instructions
    if (i >>> 11 === 0b11001) return processLDMIA(cpu, i);
    if (i >>> 9 === 0b1011110) return processPOP(cpu, i);
    if (i >>> 9 === 0b1011010) return processPUSH(cpu, i);
    if (i >>> 11 === 0b11000) return processSTMIA(cpu, i);

    return { incrementPC: true };
}

// Branch Instructions
const processB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`B (${type})`);
    return { incrementPC: true };
}

const processBL_BLX1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BL');
    return { incrementPC: true };
}

const processBL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BL');
    return { incrementPC: true };
}

const processBX = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BX');
    return { incrementPC: true };
}

const processBLX2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BL');
    return { incrementPC: true };
}

// Data Processing Instructions

const processADC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('ADC');
    return { incrementPC: true };
}

const processADD = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`ADD (${type})`);
    return { incrementPC: true };
}

const processAND = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('AND');
    return { incrementPC: true };
}

const processASR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`ASR (${type})`);
    return { incrementPC: true };
}

const processBIC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BIC');
    return { incrementPC: true };
}

const processCMN = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('CMN');
    return { incrementPC: true };
}

const processCMP = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`CMP (${type})`);
    return { incrementPC: true };
}

const processEOR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('EOR');
    return { incrementPC: true };
}

const processLSL = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LSL (${type})`);
    return { incrementPC: true };
}

const processLSR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LSR (${type})`);
    return { incrementPC: true };
}

const processMOV = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`MOV (${type})`);
    return { incrementPC: true };
}

const processMUL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MUL');
    return { incrementPC: true };
}

const processMVN = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MVN');
    return { incrementPC: true };
}

const processNEG = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('NEG');
    return { incrementPC: true };
}

const processORR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('ORR');
    return { incrementPC: true };
}

const processROR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('ROR');
    return { incrementPC: true };
}

const processSBC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SBC');
    return { incrementPC: true };
}

const processSUB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`SUB (${type})`);
    return { incrementPC: true };
}

const processTST = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('TST');
    return { incrementPC: true };
}

// load / Store Instructions

const processLDR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDR (${type})`);
    return { incrementPC: true };
}

const processLDRB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDRB (${type})`);
    return { incrementPC: true };
}

const processLDRH = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDRH (${type})`);
    return { incrementPC: true };
}

const processLDRSB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRSB');
    return { incrementPC: true };
}

const processLDRSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRSH');
    return { incrementPC: true };
}

const processSTR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STR (${type})`);
    return { incrementPC: true };
}

const processSTRB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STRB (${type})`);
    return { incrementPC: true };
}

const processSTRH = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STRH (${type})`);
    return { incrementPC: true };
}

// Load / Store Multiple Instructions

const processLDMIA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDMIA');
    return { incrementPC: true };
}

const processPOP = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('POP');
    return { incrementPC: true };
}

const processPUSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('PUSH');
    return { incrementPC: true };
}

const processSTMIA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STMIA');
    return { incrementPC: true };
}

// Exception Generating Instructions

const processBKPT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BKPT');
    return { incrementPC: true };
}

const processSWI = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SWI');
    return { incrementPC: true };
}



export { processTHUMB }