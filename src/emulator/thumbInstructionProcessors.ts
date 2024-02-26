import { CPU, Reg } from './cpu';
import { ProcessedInstructionOptions } from './armInstructionProcessors';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight,
    signExtend, byteArrayToInt32, int32ToByteArray, int16ToByteArray,
    int8ToByteArray, 
    numberOfSetBits,
    asHex,
    isNegative32,
    signedOverflowFromAddition,
    borrowFrom,
    signedOverflowFromSubtraction,
    isNegative,
    wordAlignAddress,
    halfWordAlignAddress} from './math';

const processTHUMB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {

    // Exception Generating Instructions
    if (i >>> 8 === 0b10111110) return processBKPT(cpu, i);
    if (i >>> 8 === 0b11011111) return processSWI(cpu, i);

    // Branch Instructions
    if ((i >>> 12 & 0xF) === 0b1101) return processB1(cpu, i);
    if ((i >>> 11 & 0x1F) === 0b11100) return processB2(cpu, i);
    if ((i >>> 13 & 0x7) === 0b111) return processBL_BLX1(cpu, i);
    if ((i >>> 7 & 0x1FF) === 0b010001110) return processBX(cpu, i);
    if ((i >>> 7 & 0x1FF) === 0b010001111) return processBLX2(cpu, i);

    // Data Processing Instructions
    if (i >>> 6 === 0b0100000101) return processADC(cpu, i);
    if (i >>> 9 === 0b0001110) return processADD1(cpu, i);
    if (i >>> 11 === 0b00110) return processADD2(cpu, i);
    if (i >>> 9 === 0b0001100) return processADD3(cpu, i);
    if (i >>> 8 === 0b01000100) return processADD4(cpu, i);
    if (i >>> 11 === 0b10100) return processADD5(cpu, i);
    if (i >>> 11 === 0b10101) return processADD6(cpu, i);
    if (i >>> 7 === 0b101100000) return processADD7(cpu, i);
    if (i >>> 6 === 0b0100000000) return processAND(cpu, i);
    if (i >>> 11 === 0b00010) return processASR1(cpu, i);
    if (i >>> 6 === 0b0100000100) return processASR2(cpu, i);
    if (i >>> 6 === 0b0100001110) return processBIC(cpu, i);
    if (i >>> 6 === 0b0100001011) return processCMN(cpu, i);
    if (i >>> 11 === 0b00101) return processCMP1(cpu, i);
    if (i >>> 6 === 0b0100001010) return processCMP2(cpu, i);
    if (i >>> 8 === 0b01000101) return processCMP3(cpu, i);
    if (i >>> 6 === 0b0100000001) return processEOR(cpu, i);
    if (i >>> 11 === 0b00000) return processLSL1(cpu, i);
    if (i >>> 6 === 0b0100000010) return processLSL2(cpu, i);
    if (i >>> 11 === 0b00001) return processLSR1(cpu, i);
    if (i >>> 6 === 0b0100000011) return processLSR2(cpu, i);
    if (i >>> 11 === 0b00100) return processMOV1(cpu, i);
    if (i >>> 6 === 0b0001110000) return processMOV2(cpu, i);
    if (i >>> 8 === 0b01000110) return processMOV3(cpu, i);
    if (i >>> 6 === 0b0100001101) return processMUL(cpu, i);
    if (i >>> 6 === 0b0100001111) return processMVN(cpu, i);
    if (i >>> 6 === 0b0100001001) return processNEG(cpu, i);
    if (i >>> 6 === 0b0100001100) return processORR(cpu, i);
    if (i >>> 6 === 0b0100000111) return processROR(cpu, i);
    if (i >>> 6 === 0b0100000110) return processSBC(cpu, i);
    if (i >>> 9 === 0b0001111) return processSUB1(cpu, i);
    if (i >>> 11 === 0b00111) return processSUB2(cpu, i);
    if (i >>> 9 === 0b0001101) return processSUB3(cpu, i);
    if (i >>> 7 === 0b101100001) return processSUB4(cpu, i);
    if (i >>> 6 === 0b0100001000) return processTST(cpu, i);

    // Load Store Instructions
    if (i >>> 11 === 0b01101) return processLDR1(cpu, i);
    if (i >>> 9 === 0b0101100) return processLDR2(cpu, i);
    if (i >>> 11 === 0b01001) return processLDR3(cpu, i);
    if (i >>> 11 === 0b10011) return processLDR4(cpu, i);
    if (i >>> 11 === 0b01111) return processLDRB1(cpu, i);
    if (i >>> 9 === 0b0101110) return processLDRB2(cpu, i);
    if (i >>> 11 === 0b10001) return processLDRH1(cpu, i);
    if (i >>> 9 === 0b0101101) return processLDRH2(cpu, i);
    if (i >>> 9 === 0b0101011) return processLDRSB(cpu, i);
    if (i >>> 9 === 0b0101111) return processLDRSH(cpu, i);
    if (i >>> 11 === 0b01100) return processSTR1(cpu, i);
    if (i >>> 9 === 0b0101000) return processSTR2(cpu, i);
    if (i >>> 11 === 0b10010) return processSTR3(cpu, i);
    if (i >>> 11 === 0b01110) return processSTRB1(cpu, i);
    if (i >>> 9 === 0b0101010) return processSTRB2(cpu, i);
    if (i >>> 11 === 0b10000) return processSTRH1(cpu, i);
    if (i >>> 9 === 0b0101001) return processSTRH2(cpu, i);

    // Load Store Multiple Instructions
    if (i >>> 11 === 0b11001) return processLDMIA(cpu, i);
    if (i >>> 9 === 0b1011110) return processPOP(cpu, i);
    if (i >>> 9 === 0b1011010) return processPUSH(cpu, i);
    if (i >>> 11 === 0b11000) return processSTMIA(cpu, i);

    return { incrementPC: true };
}

// Branch Instructions

const processB1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`B (1)`);
    // #REMOVE_IN_BUILD_END

    let pcUpdated = false;
    const instructionSize = 2;
    const condition = (i >>> 8) & 0xF;
    const imm = i & 0xFF;
    const pc = cpu.getGeneralRegister(Reg.PC);
    let offset;
    if (isNegative(imm, 8)) {
        offset = -1 * (((~imm) + 1) & 0xFF);
    } else {
        offset = imm;
    }
    const newPC = pc + (offset << 1) + (instructionSize * 2);
    if (cpu.conditionIsMet(condition)) {
        pcUpdated = true;
        cpu.setGeneralRegister(Reg.PC, newPC);
    }
    return { incrementPC: !pcUpdated };
}

const processB2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`B (2)`);
    // #REMOVE_IN_BUILD_END

    let pcUpdated = false;
    const instructionSize = 2;
    const imm = i & 0x7FF;
    const pc = cpu.getGeneralRegister(Reg.PC);
    let offset;
    if (isNegative(imm, 11)) {
        offset = -1 * (((~(imm << 1)) + 1) & 0x7FF);
    } else {
        offset = imm << 1;
    }
    const newPC = pc + offset + (instructionSize * 2);
    cpu.setGeneralRegister(Reg.PC, newPC);
    pcUpdated = true;

    return { incrementPC: !pcUpdated };
}

const processBL_BLX1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('BL');
    // #REMOVE_IN_BUILD_END

    const instructionSize = 2;
    const h = (i >>> 11) & 0x3;
    const offset = i & 0x7FF;
    const pc = cpu.getGeneralRegister(Reg.PC);

    if (h === 0b10) {
        const signExtendedOffset = isNegative(offset, 11) ?
            -1 * ((~offset + 1) & 0x7FF) :
            offset;
        cpu.setGeneralRegister(Reg.LR, pc + ((signExtendedOffset) << 12));
        return { incrementPC: true };
    } else if (h === 0b11) {
        const newPC = cpu.getGeneralRegister(Reg.LR) + (offset << 1) + (instructionSize * 2);
        cpu.setGeneralRegister(Reg.LR, (pc - (instructionSize * 2) + 2) | 1);
        cpu.setGeneralRegister(Reg.PC, newPC);
    } else if (h === 0b01) {
        cpu.history.addError(`BLX (1) instruction (0x${i.toString(16)}) is not a supported version 4 THUMB instruction.`);
        const newPC = (cpu.getGeneralRegister(Reg.LR) + (offset << 1) + (instructionSize * 2)) & 0xFFFFFFFC;
        cpu.setGeneralRegister(Reg.LR, (pc + 2) | 1);
        cpu.setGeneralRegister(Reg.PC, newPC);
        cpu.setStatusRegisterFlag('t', 0);
    }

    return { incrementPC: false };
}

const processBX = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('BX');
    // #REMOVE_IN_BUILD_END

    const h2 = (i >>> 6) & 0x1;
    const rm = ((i >>> 3) & 0x7) + (h2 << 3);
    const rmValue = cpu.getGeneralRegister(rm);
    const tFlag = rmValue & 0x1;
    cpu.setStatusRegisterFlag('t', tFlag);

    const nextInstructionSize = tFlag === 1 ? 2 : 4;
    cpu.setGeneralRegister(Reg.PC, (rmValue + (nextInstructionSize * 2)) & (~0x1));

    return { incrementPC: false };
}

const processBLX2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('BL');
    // #REMOVE_IN_BUILD_END

    const instructionSize = 2;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rm = (h2 << 3) | rmLow;
    const rmValue = cpu.getGeneralRegister(rm);
    const pc = cpu.getGeneralRegister(Reg.PC);
    cpu.setGeneralRegister(Reg.LR, (pc + instructionSize) | 1);
    cpu.setStatusRegisterFlag('t', rmValue & 0x1);
    cpu.setGeneralRegister(Reg.PC, (rmValue + (instructionSize * 2)) & (~0x1));

    return { incrementPC: false };
}

// Data Processing Instructions

const processADC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('ADC');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const operand1 = cpu.getGeneralRegister(rd);
    const operand2 = cpu.getGeneralRegister(rm);
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');

    const result = operand1 + operand2 + cFlag;
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result32);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', (result > 2**32 - 1));
    cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(operand1, operand2 + cFlag, result32));

    return { incrementPC: true };
}

const processADD1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (1)`);
    // #REMOVE_IN_BUILD_END

    const rd = i & 0x7;
    const rn = (i >>> 3) & 0x7;
    const imm = (i >>> 6) & 0x7;
    const op1 = imm;
    const op2 = cpu.getGeneralRegister(rn);

    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', result > 2**32 - 1);
    cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(op1, op2, result32));

    return { incrementPC: true };
}

const processADD2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (2)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const op1 = cpu.getGeneralRegister(rd);
    const op2 = imm;

    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;
    
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', result > 2**32 - 1);
    cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(op1, op2, result32));

    return { incrementPC: true };
}

const processADD3 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (3)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const op1 = cpu.getGeneralRegister(rn);;
    const op2 = cpu.getGeneralRegister(rm);

    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', result > 2**32 - 1);
    cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(op1, op2, result32));

    return { incrementPC: true };
}

const processADD4 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (4)`);
    // #REMOVE_IN_BUILD_END

    const h1 = (i >>> 7) & 0x1;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rdLow = i & 0x7;
    const rm = (h2 << 3) | rmLow;
    const rd = (h1 << 3) | rdLow;
    const op1 = cpu.getGeneralRegister(rd);
    const op2 = cpu.getGeneralRegister(rm);

    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    return { incrementPC: true };
}

const processADD5 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (5)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const op1 = cpu.getGeneralRegister(Reg.PC) & 0xFFFFFFFC;
    const op2 = imm << 2;

    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);

    return { incrementPC: true };
}

const processADD6 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (6)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const op1 = cpu.getGeneralRegister(Reg.SP);
    const op2 = imm << 2;
    
    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    return { incrementPC: true };
}

const processADD7 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ADD (7)`);
    // #REMOVE_IN_BUILD_END

    const rd = Reg.SP;
    const op1 = cpu.getGeneralRegister(Reg.SP);
    const op2 = (i & 0x7F) << 2;

    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    return { incrementPC: true };
}

const processAND = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('AND');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rm) & cpu.getGeneralRegister(rd);
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result32);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);

    return { incrementPC: true };
}

const processASR1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ASR (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rm = (i >>> 3) & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const rd = i & 0x7;
    let result;
    if (imm === 0) {
        const rm31 = (rmValue >>> 31) & 0x1;
        cpu.setStatusRegisterFlag('c', rm31 === 1);
        result = rm31 === 0 ? 0 : 0xFFFFFFFF;
    } else {
        cpu.setStatusRegisterFlag('c', (((rmValue >>> (imm - 1)) & 0x1) === 1));
        const [shift, carryOut] = arithmeticShiftRight(rmValue, imm);
        result = shift;
    }
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processASR2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`ASR (2)`);
    // #REMOVE_IN_BUILD_END

    const rs = (i >>> 3) & 0x7;
    const rsValue = cpu.getGeneralRegister(rs);
    const rs7_0 = rsValue & 0xFF;
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    let result;
    if (rs7_0 === 0) {
        // Do nothing
        result = rdValue;
    } else if (rs7_0 < 32) {
        cpu.setStatusRegisterFlag('c', (((rd >>> (rs7_0 - 1)) & 0x1) === 1));
        const [shift, carryOut] = arithmeticShiftRight(rdValue, rs7_0);
        result = shift;
    } else {
        const rd31 = (rdValue >>> 31) & 0x1;
        cpu.setStatusRegisterFlag('c', rd31);
        result = rd31 === 0 ? 0 : 0xFFFFFFFF;
    }
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processBIC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('BIC');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = (cpu.getGeneralRegister(rd) & (~cpu.getGeneralRegister(rm))) & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);

    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processCMN = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('CMN');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const rnValue = cpu.getGeneralRegister(rn);
    const aluOut = rmValue + rnValue;
    const aluOut32 = aluOut & 0xFFFFFFFF;

    cpu.setStatusRegisterFlag('n', isNegative32(aluOut32));
    cpu.setStatusRegisterFlag('z', aluOut32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(rmValue, -rnValue) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(rmValue, rnValue, aluOut32));

    return { incrementPC: true };
}

const processCMP1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`CMP (1)`);
    // #REMOVE_IN_BUILD_END

    const rn = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const rnValue = cpu.getGeneralRegister(rn);
    const operand1 = rnValue;
    const operand2 = imm;

    const aluOut = operand1 - operand2;
    const aluOut32 = aluOut & 0xFFFFFFFF;

    cpu.setStatusRegisterFlag('n', isNegative32(aluOut32));
    cpu.setStatusRegisterFlag('z', aluOut32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(operand1, operand2) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(operand1, operand2, aluOut32));

    return { incrementPC: true };
}

const processCMP2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`CMP (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    const operand1 = cpu.getGeneralRegister(rn);
    const operand2 = cpu.getGeneralRegister(rm);

    const aluOut = operand1 - operand2;
    const aluOut32 = aluOut & 0xFFFFFFFF;

    cpu.setStatusRegisterFlag('n', isNegative32(aluOut32));
    cpu.setStatusRegisterFlag('z', aluOut32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(operand1, operand2) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(operand1, operand2, aluOut32));

    return { incrementPC: true };
}

const processCMP3 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`CMP (3)`);
    // #REMOVE_IN_BUILD_END

    const h1 = (i >>> 7) & 0x1;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rnLow = i && 0x7;
    const rn = (h1 << 3) | rnLow;
    const rm = (h2 << 3) | rmLow;
    const operand1 = cpu.getGeneralRegister(rn);
    const operand2 = cpu.getGeneralRegister(rm);

    const aluOut = operand1 - operand2;
    const aluOut32 = aluOut & 0xFFFFFFFF;

    cpu.setStatusRegisterFlag('n', isNegative32(aluOut32));
    cpu.setStatusRegisterFlag('z', aluOut32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(operand1, operand2) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(operand1, operand2, aluOut32));

    return { incrementPC: true };
}

const processEOR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('EOR');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rd) ^ cpu.getGeneralRegister(rm);
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);

    return { incrementPC: true };
}

const processLSL1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LSL (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rm = (i >>> 3) & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const rd = i & 0x7;
    let result;
    if (imm === 0) {
        result = rmValue;
    } else {
        cpu.setStatusRegisterFlag('c', (rmValue >>> (32 - imm)) & 0x1);
        const [shift, carry] = logicalShiftLeft(rmValue, imm);
        result = shift;
    }
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);

    return { incrementPC: true };
}

const processLSL2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LSL (2)`);
    // #REMOVE_IN_BUILD_END

    const rs = (i >>> 3) & 0x7;
    const rsValue = cpu.getGeneralRegister(rs);
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    let result;
    if ((rsValue & 0xFF) === 0) {
        result = rdValue;
    } else if ((rsValue & 0xFF) < 32) {
        cpu.setStatusRegisterFlag('c', (rdValue >>> (32 - (rsValue & 0xFF))) & 0x1);
        const [shift, carry] = logicalShiftLeft(rdValue, (rsValue & 0xFF));
        result = shift;
    } else if ((rsValue & 0xFF) === 32) {
        cpu.setStatusRegisterFlag('c', rdValue & 0x1);
        result = 0;
    } else {
        cpu.setStatusRegisterFlag('c', 0);
        result = 0;
    }
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);

    return { incrementPC: true };
}

const processLSR1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LSR (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rm = (i >>> 3) & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    let result;
    if (imm === 0) {
        cpu.setStatusRegisterFlag('c', isNegative32(rdValue));
        result = 0;
    } else {
        cpu.setStatusRegisterFlag('c', ((rdValue >>> (imm - 1)) & 0x1) === 1);
        const [shift, carry] = logicalShiftRight(rmValue, imm);
        result = shift;
    }
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processLSR2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LSR (2)`);
    // #REMOVE_IN_BUILD_END

    const rs = (i >>> 3) & 0x7;
    const rsValue = cpu.getGeneralRegister(rs);
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    let result;
    if ((rsValue & 0xFF) === 0) {
        result = rdValue;
    } else if ((rsValue & 0xFF) < 32) {
        cpu.setStatusRegisterFlag('c', ((rdValue >>> ((rsValue & 0xFF) - 1)) & 0x1) === 1);
        const [shift, carry] = logicalShiftRight(rdValue, (rsValue & 0xFF));
        result = shift;
    } else if ((rsValue & 0xFF) === 32) {
        cpu.setStatusRegisterFlag('c', isNegative32(rdValue));
        result = 0;
    } else {
        cpu.setStatusRegisterFlag('c', 0);
        result = 0;
    }
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processMOV1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`MOV (1)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    cpu.setGeneralRegister(rd, imm);
    cpu.setStatusRegisterFlag('n', 0);
    cpu.setStatusRegisterFlag('z', imm === 0);

    return { incrementPC: true };
}

const processMOV2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`MOV (2)`);
    // #REMOVE_IN_BUILD_END

    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rn);
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);
    cpu.setStatusRegisterFlag('c', 0);
    cpu.setStatusRegisterFlag('v', 0);

    return { incrementPC: true };
}

const processMOV3 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`MOV (3)`);
    // #REMOVE_IN_BUILD_END

    const h1 = (i >>> 7) & 0x1;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rdLow = i & 0x7;
    const rm = (h2 << 3) | rmLow;
    const rd = (h1 << 3) | rdLow;
    cpu.setGeneralRegister(rd, cpu.getGeneralRegister(rm));

    return { incrementPC: true };
}

const processMUL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    /**
     * This instruction only uses the lower 32 bits of the multiplication, which are the same in
     * signed and unsigned multiplications. Therefore this instruction works for any combination
     * of signed and unsigned inputs.
     */

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MUL');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rm) * cpu.getGeneralRegister(rd);
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result32);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);

    return { incrementPC: true };
}

const processMVN = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MVN');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = ~cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, result);

    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processNEG = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('NEG');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const result = 0 - rmValue;
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result32);

    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(0, rmValue) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(0, rmValue, result32));

    return { incrementPC: true };
}

const processORR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('ORR');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rd) | cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, result);

    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processROR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('ROR');
    // #REMOVE_IN_BUILD_END

    const rs = (i >>> 3) & 0x7;
    const rsValue = cpu.getGeneralRegister(rs);
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    let result;

    if ((rsValue & 0xFF) === 0) {
        result = rdValue;
    } else if ((rsValue & 0x1F) === 0) {
        cpu.setStatusRegisterFlag('c', isNegative32(rdValue));
        result = rdValue;
    } else {
        cpu.setStatusRegisterFlag('c', ((rdValue >>> ((rsValue & 0x1F) - 1)) & 0x1));
        result = rotateRight(rdValue, (rsValue & 0x1F), 32);
    }

    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', isNegative32(result));
    cpu.setStatusRegisterFlag('z', result === 0);

    return { incrementPC: true };
}

const processSBC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SBC');
    // #REMOVE_IN_BUILD_END

    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');

    const rm = (i >>> 3) & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    const notC = cFlag === 1 ? 0 : 1;
    const result = rdValue - rmValue - notC;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);

    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(rdValue, rmValue + notC) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(rdValue, rmValue + notC, result32));

    return { incrementPC: true };
}

const processSUB1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`SUB (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rnValue = cpu.getGeneralRegister(rn);
    const rd = i & 0x7;
    const result = rnValue - imm;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);
    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(rnValue, imm) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(rnValue, imm, result32));

    return { incrementPC: true };
}

const processSUB2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`SUB (2)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    const imm = i & 0xFF;
    const result = rdValue - imm;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(rdValue, imm) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(rdValue, imm, result32));

    return { incrementPC: true };
}

const processSUB3 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`SUB (3)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    const rn = (i >>> 3) & 0x7;
    const rnValue = cpu.getGeneralRegister(rn);
    const rd = i & 0x7;
    const result = rnValue - rmValue;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);

    cpu.setStatusRegisterFlag('n', isNegative32(result32));
    cpu.setStatusRegisterFlag('z', result32 === 0);
    cpu.setStatusRegisterFlag('c', borrowFrom(rnValue, rmValue) === 0);
    cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(rnValue, rmValue, result32));

    return { incrementPC: true };
}

const processSUB4 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`SUB (4)`);
    // #REMOVE_IN_BUILD_END

    const imm = i & 0x7F;
    const result = cpu.getGeneralRegister(Reg.SP) - (imm << 2);
    cpu.setGeneralRegister(Reg.SP, result);

    return { incrementPC: true };
}

const processTST = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('TST');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    const aluOut = cpu.getGeneralRegister(rn) & cpu.getGeneralRegister(rm);

    cpu.setStatusRegisterFlag('n', isNegative32(aluOut));
    cpu.setStatusRegisterFlag('z', aluOut === 0);

    return { incrementPC: true };
}

// load / Store Instructions

const processLDR1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDR (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + (imm * 4);
    cpu.setGeneralRegister(rd, cpu.memory.getInt32(wordAlignAddress(address)));

    return { incrementPC: true };
}

const processLDR2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDR (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, cpu.memory.getInt32(wordAlignAddress(address)));

    return { incrementPC: true };
}

const processLDR3 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDR (3)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const pc = cpu.getGeneralRegister(Reg.PC);
    const address = (((pc >> 2)) << 2) + (imm * 4);
    cpu.setGeneralRegister(rd, cpu.memory.getInt32(wordAlignAddress(address)));

    return { incrementPC: true };
}

const processLDR4 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDR (4)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const sp = cpu.getGeneralRegister(Reg.SP);
    const address = sp + (imm * 4);
    cpu.setGeneralRegister(rd, cpu.memory.getInt32(wordAlignAddress(address)));

    return { incrementPC: true };
}

const processLDRB1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDRB (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + imm;
    cpu.setGeneralRegister(rd, cpu.memory.getInt8(address));

    return { incrementPC: true };
}

const processLDRB2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDRB (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, cpu.memory.getInt8(address));

    return { incrementPC: true };
}

const processLDRH1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDRH (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + (imm * 2);
    cpu.setGeneralRegister(rd, cpu.memory.getInt16(halfWordAlignAddress(address)));

    return { incrementPC: true };
}

const processLDRH2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDRH (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, cpu.memory.getInt16(halfWordAlignAddress(address)));

    return { incrementPC: true };
}

const processLDRSB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRSB');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, signExtend(cpu.memory.getInt8(address), 8));

    return { incrementPC: true };
}

const processLDRSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRSH');
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, signExtend(cpu.memory.getInt16(halfWordAlignAddress(address)), 16));

    return { incrementPC: true };
}

const processSTR1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STR (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + (imm * 4);
    const data = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(wordAlignAddress(address), data);

    return { incrementPC: true };
}

const processSTR2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STR (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    const data = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(wordAlignAddress(address), data);

    return { incrementPC: true };
}

const processSTR3 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STR (3)`);
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    const sp = cpu.getGeneralRegister(Reg.SP);
    const address = sp + (imm * 4);
    const data = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(wordAlignAddress(address), data);

    return { incrementPC: true };
}

const processSTRB1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STRB (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + imm;
    const data = int8ToByteArray((cpu.getGeneralRegister(rd) & 0xFF), cpu.bigEndian);
    cpu.setBytesInMemory(address, data);

    return { incrementPC: true };
}

const processSTRB2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STRB (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    const data = int8ToByteArray((cpu.getGeneralRegister(rd) & 0xFF), cpu.bigEndian);
    cpu.setBytesInMemory(address, data);

    return { incrementPC: true };
}

const processSTRH1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STRH (1)`);
    // #REMOVE_IN_BUILD_END

    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + (imm * 2);
    const data = int16ToByteArray((cpu.getGeneralRegister(rd) & 0xFFFF), cpu.bigEndian);
    cpu.setBytesInMemory(halfWordAlignAddress(address), data);

    return { incrementPC: true };
}

const processSTRH2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STRH (2)`);
    // #REMOVE_IN_BUILD_END

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    const data = int16ToByteArray((cpu.getGeneralRegister(rd) & 0xFFFF), cpu.bigEndian);
    cpu.setBytesInMemory(halfWordAlignAddress(address), data);

    return { incrementPC: true };
}

// Load / Store Multiple Instructions

const processLDMIA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDMIA');
    // #REMOVE_IN_BUILD_END

    const rn = (i >>> 8) & 0x7;
    const regList = i & 0xFF;
    const startAddress = cpu.getGeneralRegister(rn);
    const endAddress = (cpu.getGeneralRegister(rn) + (numberOfSetBits(regList) * 4) - 4) & 0xFFFFFFFF;
    let address = wordAlignAddress(startAddress);
    for (let reg = 0; reg <= 7; reg++) {
        if (((regList >>> reg) & 0x1) === 1) {
            cpu.setGeneralRegister(reg, cpu.memory.getInt32(address));
            address += 4;
        }
    }

    if (address - 4 !== endAddress) {
        throw Error(`Final address of 0x${address.toString(16).padStart(8, '0')} != expected end address 0x${endAddress.toString(16).padStart(8, '0')}`);
    }

    const rnValue = cpu.getGeneralRegister(rn);
    cpu.setGeneralRegister(rn, (rnValue + (numberOfSetBits(regList) * 4)) & 0xFFFFFFFF);

    return { incrementPC: true };
}

const processPOP = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('POP');
    // #REMOVE_IN_BUILD_END

    const r = (i >>> 8) & 0x1;
    const regList = i & 0xFF;
    const sp = cpu.getGeneralRegister(Reg.SP);
    const startAddress = sp;
    const endAddress = sp + 4 * (r + numberOfSetBits(regList));
    let address = wordAlignAddress(startAddress);

    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            cpu.setGeneralRegister(i, cpu.memory.getInt32(address));
            address += 4;
        }
    }

    if (r === 1) {
        cpu.setGeneralRegister(Reg.PC, cpu.memory.getInt32(address) & 0xFFFFFFFE);
        address += 4;
    }

    // TODO: remove these checks in builds
    if (endAddress !== address) {
        throw Error(`End address ${asHex(address)} != expected end address ${asHex(endAddress)}.`);
    }

    cpu.setGeneralRegister(Reg.SP, endAddress);

    return { incrementPC: r !== 1 };
}

const processPUSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('PUSH');
    // #REMOVE_IN_BUILD_END

    const r = (i >>> 8) & 0x1;
    const regList = i & 0xFF;
    const sp = cpu.getGeneralRegister(Reg.SP);
    const startAddress = sp - 4 * (r + numberOfSetBits(regList));
    const endAddress = sp - 4;
    let address = wordAlignAddress(startAddress);

    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            const data = int32ToByteArray(cpu.getGeneralRegister(i), cpu.bigEndian);
            cpu.setBytesInMemory(address, data);
            address += 4;
        }
    }

    if (r === 1) {
        const lr = cpu.getGeneralRegister(Reg.LR);
        cpu.setBytesInMemory(address, int32ToByteArray(lr, cpu.bigEndian));
        address += 4;
    }

    if (endAddress !== address - 4) {
        throw Error(`Ending address ${asHex(address)} != expected (end address - 4) ${asHex(endAddress - 4)}.`);
    }

    cpu.setGeneralRegister(Reg.SP, sp - 4 * (r + numberOfSetBits(regList)));

    return { incrementPC: true };
}

const processSTMIA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('STMIA');
    // #REMOVE_IN_BUILD_END

    const rn = (i >>> 8) & 0x7;
    const rnValue = cpu.getGeneralRegister(rn);
    const regList = i & 0xFF;
    const startAddress = cpu.getGeneralRegister(rn);
    const endAddress = cpu.getGeneralRegister(rn) + (numberOfSetBits(regList) * 4) - 4;
    let address = startAddress;
    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            const data = int32ToByteArray(cpu.getGeneralRegister(i), cpu.bigEndian);
            cpu.setBytesInMemory(address, data);
            address += 4;
        }
    }

    if (endAddress != address - 4) {
        cpu.history.currentLog.errors.push(`Ending address - 4 ${asHex(endAddress - 4)} != expected end address ${asHex(endAddress)}`);
    }

    cpu.setGeneralRegister(rn, rnValue + (numberOfSetBits(regList) * 4));

    return { incrementPC: true };
}

// Exception Generating Instructions

const processBKPT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BKPT');
    cpu.history.addError(`BKPT not implemented: 0x${i.toString(16).padStart(8, '0')}.`);
    return { incrementPC: true };
}

const processSWI = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SWI');
    cpu.history.addError(`BKPT not implemented: 0x${i.toString(16).padStart(8, '0')}.`);
    return { incrementPC: true };
}



export { processTHUMB }