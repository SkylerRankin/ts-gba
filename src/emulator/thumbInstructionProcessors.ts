import { CPU, Reg } from './cpu';
import { ProcessedInstructionOptions } from './armInstructionProcessors';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight,
    signExtend, byteArrayToInt32, int32ToByteArray, int16ToByteArray,
    int8ToByteArray, 
    numberOfSetBits,
    asHex,
    isNegative32,
    signedOverflowFromAddition} from './math';

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

    switch (type) {
        case 1: {
            const cond = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            const pc = cpu.getGeneralRegister(Reg.PC);
            const newPC = pc + (signExtend(imm, 32) << 1);
            // TODO check condition correctly
            if (cond > 0) {
                cpu.setGeneralRegister(Reg.PC, newPC);
            }
            break;
        }
        case 2: {
            const imm = i & 0x7FF;
            const pc = cpu.getGeneralRegister(Reg.PC);
            const newPC = pc + (signExtend(pc, 32) << 1);
            cpu.setGeneralRegister(Reg.PC, newPC);
        }
    }

    return { incrementPC: false };
}

const processBL_BLX1 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BL');

    const h = (i >>> 11) & 0x3;
    const offset = i & 0x7FF;
    const pc = cpu.getGeneralRegister(Reg.PC);

    if (h === 0b10) {
        cpu.setGeneralRegister(Reg.LR, pc + (signExtend(offset, 32) << 12));
        return { incrementPC: true };
    } else if (h === 0b11) {
        const newPC = cpu.getGeneralRegister(Reg.LR) + (offset << 1);
        cpu.setGeneralRegister(Reg.LR, (pc + 2) | 1);
        cpu.setGeneralRegister(Reg.PC, newPC);
    } else if (h === 0b01) {
        const newPC = (cpu.getGeneralRegister(Reg.LR) + (offset << 1)) & 0xFFFFFFFC;
        cpu.setGeneralRegister(Reg.LR, (pc + 2) | 1);
        cpu.setGeneralRegister(Reg.PC, newPC);
        cpu.setStatusRegisterFlag('t', 0);
    }

    return { incrementPC: false };
}

const processBX = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BX');

    const h2 = (i >>> 6) & 0x1;
    const rm = (i >>> 3) & 0x7;
    const rmValue = cpu.getGeneralRegister(rm);
    cpu.setStatusRegisterFlag('t', rmValue & 0x1);
    cpu.setGeneralRegister(Reg.PC, rmValue & (~0x1));

    return { incrementPC: true };
}

const processBLX2 = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BL');

    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rm = (h2 << 3) | rmLow;
    const rmValue = cpu.getGeneralRegister(rm);
    const pc = cpu.getGeneralRegister(Reg.PC);
    cpu.setGeneralRegister(Reg.LR, (pc + 2) | 1);
    cpu.setStatusRegisterFlag('t', rmValue & 0x1);
    cpu.setGeneralRegister(Reg.PC, rmValue & (~0x1));

    return { incrementPC: true };
}

// Data Processing Instructions

const processADC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('ADC');
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const operand1 = cpu.getGeneralRegister(rd);
    const operand2 = cpu.getGeneralRegister(rm);
    const cFlag = cpu.getStatusRegisterFlag('c');

    const result = operand1 + operand2 + cFlag;
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result32);
    cpu.clearConditionCodeFlags();
    if (isNegative32(result32)) cpu.setConditionCodeFlags('n');
    if (result32 === 0) cpu.setConditionCodeFlags('z');
    if (result > 2**32 - 1) cpu.setConditionCodeFlags('c');
    if (signedOverflowFromAddition(operand1, operand2 + cFlag, result32)) cpu.setConditionCodeFlags('v');

    return { incrementPC: true };
}

const processADD = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`ADD (${type})`);
    let rd;
    let op1;
    let op2;
    switch (type) {
        case 1: {
            rd = i & 0x7;
            const imm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            op1 = imm;
            op2 = cpu.getGeneralRegister(rn);
            break;
        }
        case 2: {
            rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            op1 = cpu.getGeneralRegister(rd);
            op2 = imm;
            break;
        }
        case 3: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            rd = i & 0x7;
            op1 = cpu.getGeneralRegister(rn);;
            op2 = cpu.getGeneralRegister(rm);
            break;
        }
        case 4: {
            const h1 = (i >>> 7) & 0x1;
            const h2 = (i >>> 6) & 0x1;
            const rmLow = (i >>> 3) & 0x7;
            const rdLow = i & 0x7;
            const rm = (h2 << 3) | rmLow;
            rd = (h1 << 3) | rdLow;
            op1 = cpu.getGeneralRegister(rd);
            op2 = cpu.getGeneralRegister(rm);
            break;
        }
        case 5: {
            rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            op1 = cpu.getGeneralRegister(Reg.PC) & 0xFFFFFFFC;
            op2 = imm << 2;
            break;
        }
        case 6: {
            rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            op1 = cpu.getGeneralRegister(Reg.SP);
            op2 = imm << 2;
            break;
        }
        case 7: {
            rd = Reg.SP;
            op1 = cpu.getGeneralRegister(Reg.SP);
            op2 = (i & 0x7F) << 2;
            break;
        }
        default: {
            // TODO improve the error handling here
            throw Error("decoding add instruction failed");
        }
    }
    
    const result = op1 + op2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);
    if (type <= 3) {
        cpu.clearConditionCodeFlags();
        if (isNegative32(result32)) cpu.setConditionCodeFlags('n');
        if (result32 === 0) cpu.setConditionCodeFlags('z');
        if (result > 2**32 - 1) cpu.setConditionCodeFlags('c');
        if (signedOverflowFromAddition(op1, op2, result32)) cpu.setConditionCodeFlags('v');
    }

    return { incrementPC: true };
}

const processAND = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('AND');
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rm) & cpu.getGeneralRegister(rd);
    const result32 = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rd, result32);

    const prevCFlag = cpu.getConditionCodeFlag('c');
    const prevVFlag = cpu.getConditionCodeFlag('v');
    cpu.clearConditionCodeFlags();

    if (isNegative32(result32)) cpu.setConditionCodeFlags('n');
    if (result32 === 0) cpu.setConditionCodeFlags('z');
    if (prevCFlag === 1) cpu.setConditionCodeFlags('c');
    if (prevVFlag === 1) cpu.setConditionCodeFlags('v');

    return { incrementPC: true };
}

const processASR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`ASR (${type})`);
    if (type === 1) {
        const imm = (i >>> 6) & 0x1F;
        const rm = (i >>> 3) & 0x7;
        const rmValue = cpu.getGeneralRegister(rm);
        const rd = i & 0x7;
        let result;
        if (imm === 0) {
            const rm31 = (rm >>> 31) & 0x1;
            cpu.setStatusRegisterFlag('c', rm31);
            result = rm31 === 0 ? 0 : 0xFFFFFFFF;
        } else {
            cpu.setStatusRegisterFlag('c', (rmValue >>> (imm - 1)) & 0x1);
            const [shift, carryOut] = arithmeticShiftRight(rmValue, imm);
            result = shift;
        }
        cpu.setGeneralRegister(rd, result);
        cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
        cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
    } else if (type === 2) {
        const rs = (i >>> 3) & 0x7;
        const rsValue = cpu.getGeneralRegister(rs);
        const rs7_0 = rsValue & 0xFF;
        const rd = i & 0x7;
        let result;
        if (rs7_0 === 0) {
            // Do nothing
            result = cpu.getGeneralRegister(rd);
        } else if (rs7_0 < 32) {
            cpu.setStatusRegisterFlag('c', (rd >>> (rs7_0 - 1)) & 0x1);
            const [shift, carryOut] = arithmeticShiftRight(rd, rs7_0);
            result = shift;
        } else {
            const rd31 = (cpu.getGeneralRegister(rd) >>> 31) & 0x1;
            cpu.setStatusRegisterFlag('c', rd31);
            result = rd31 === 0 ? 0 : 0xFFFFFFFF;
        }
        cpu.setGeneralRegister(rd, result);
        cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
        cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);   
    }
    return { incrementPC: true };
}

const processBIC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BIC');
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rd) & (~cpu.getGeneralRegister(rm));
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
    return { incrementPC: true };
}

const processCMN = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('CMN');
    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    const aluOut = cpu.getGeneralRegister(rm) + cpu.getGeneralRegister(rn);
    cpu.setStatusRegisterFlag('n', (aluOut >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', aluOut === 0 ? 1 : 0);
    // TODO c and v flags
    cpu.setStatusRegisterFlag('c', 0);
    cpu.setStatusRegisterFlag('v', 0);
    return { incrementPC: true };
}

const processCMP = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`CMP (${type})`);
    let aluOut;
    switch (type) {
        case 1: {
            const rn = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            aluOut = cpu.getGeneralRegister(rn) - imm;
            break;
        }
        case 2: {
            const rm = (i >>> 3) & 0x7;
            const rn = i & 0x3;
            aluOut = cpu.getGeneralRegister(rn) - cpu.getGeneralRegister(rm);
            break;
        }
        case 3: {
            const h1 = (i >>> 7) & 0x1;
            const h2 = (i >>> 6) & 0x1;
            const rmLow = (i >>> 3) & 0x7;
            const rnLow = i && 0x7;
            const rm = (1 << h1) | rmLow;
            const rn = (1 << h2) | rnLow;
            aluOut = cpu.getGeneralRegister(rn) - cpu.getGeneralRegister(rm);
            break;
        }
    }

    if (aluOut) {
        cpu.setStatusRegisterFlag('n', (aluOut >>> 31) & 0x1);
        cpu.setStatusRegisterFlag('z', aluOut === 0 ? 1 : 0);
        // TODO
        // cpu.setStatusRegisterFlag('c', (aluOut >>> 31) & 0x1);
        // cpu.setStatusRegisterFlag('v', (aluOut >>> 31) & 0x1);
    }

    return { incrementPC: true };
}

const processEOR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('EOR');
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rd) ^ cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
    return { incrementPC: true };
}

const processLSL = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LSL (${type})`);

    switch (type) {
        case 1: {
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
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            break;
        }
        case 2: {
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
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            break;
        }
    }

    return { incrementPC: true };
}

const processLSR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LSR (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rm = (i >>> 3) & 0x7;
            const rmValue = cpu.getGeneralRegister(rm);
            const rd = i & 0x7;
            const rdValue = cpu.getGeneralRegister(rd);
            let result;
            if (imm === 0) {
                cpu.setStatusRegisterFlag('c', (rdValue >>> 31) & 0x1);
                result = 0;
            } else {
                cpu.setStatusRegisterFlag('c', (rdValue >>> (imm - 1)) & 0x1);
                const [shift, carry] = logicalShiftRight(rmValue, imm);
                result = shift;
            }
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            break;
        }
        case 2: {
            const rs = (i >>> 3) & 0x7;
            const rsValue = cpu.getGeneralRegister(rs);
            const rd = i & 0x7;
            const rdValue = cpu.getGeneralRegister(rd);
            let result;
            if ((rsValue & 0xFF) === 0) {
                result = rdValue;
            } else if ((rsValue & 0xFF) < 32) {
                cpu.setStatusRegisterFlag('c', (rdValue >>> ((rsValue & 0xFF) - 1)) & 0x1);
                const [shift, carry] = logicalShiftRight(rdValue, (rsValue & 0xFF));
                result = shift;
            } else if ((rsValue & 0xFF) === 32) {
                cpu.setStatusRegisterFlag('c', (rdValue >>> 31) & 0x1);
                result = 0;
            } else {
                cpu.setStatusRegisterFlag('c', 0);
                result = 0;
            }
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            break;
        }
    }

    return { incrementPC: true };
}

const processMOV = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`MOV (${type})`);

    switch (type) {
        case 1: {
            const rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            cpu.setGeneralRegister(rd, imm);
            cpu.setStatusRegisterFlag('n', (imm >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', imm === 0 ? 1 : 0);
            break;
        }
        case 2: {
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const result = cpu.getGeneralRegister(rn);
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            cpu.setStatusRegisterFlag('c', 0);
            cpu.setStatusRegisterFlag('v', 0);
            break;
        }
        case 3: {
            const h1 = (i >>> 7) & 0x1;
            const h2 = (i >>> 6) & 0x1;
            const rmLow = (i >>> 3) & 0x7;
            const rdLow = i & 0x7;
            const rm = (h2 << 3) | rmLow;
            const rd = (h1 << 3) | rdLow;
            cpu.setGeneralRegister(rd, cpu.getGeneralRegister(rm));
            break;
        }
    }

    return { incrementPC: true };
}

const processMUL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MUL');

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = (cpu.getGeneralRegister(rm) * cpu.getGeneralRegister(rd)) & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);

    return { incrementPC: true };
}

const processMVN = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MVN');

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = ~cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);

    return { incrementPC: true };
}

const processNEG = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('NEG');

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = 0 - cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
    // TODO set c and v flags

    return { incrementPC: true };
}

const processORR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('ORR');

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const result = cpu.getGeneralRegister(rd) | cpu.getGeneralRegister(rm);
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);

    return { incrementPC: true };
}

const processROR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('ROR');

    const rs = (i >>> 3) & 0x7;
    const rsValue = cpu.getGeneralRegister(rs);
    const rd = i & 0x7;
    const rdValue = cpu.getGeneralRegister(rd);
    let result;

    if ((rsValue & 0xFF) === 0) {
        result = rdValue;
    } else if ((rsValue & 0x1F) === 0) {
        cpu.setStatusRegisterFlag('c', (rdValue >>> 31) & 0x1);
        result = rdValue;
    } else {
        cpu.setStatusRegisterFlag('c', (rdValue >>> ((rsValue & 0x1F) - 1)) & 0x1);
        result = rotateRight(rdValue, (rs & 0x1F), 32);
    }

    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);

    return { incrementPC: true };
}

const processSBC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SBC');

    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const notC = cpu.getStatusRegisterFlag('c') === 1 ? 0 : 1;
    const result = (cpu.getGeneralRegister(rd) - cpu.getGeneralRegister(rm)) - notC;
    cpu.setGeneralRegister(rd, result);
    cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
    // TODO set c and v

    return { incrementPC: true };
}

const processSUB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`SUB (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const result = cpu.getGeneralRegister(rn) - imm;
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            // TODO
            break;
        }
        case 2: {
            const rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            const result = cpu.getGeneralRegister(rd) - imm;
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            // TODO
            break;
        }
        case 3: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const result = cpu.getGeneralRegister(rn) - cpu.getGeneralRegister(rm);
            cpu.setGeneralRegister(rd, result);
            cpu.setStatusRegisterFlag('n', (result >>> 31) & 0x1);
            cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
            // TODO
            break;
        }
        case 4: {
            const imm = i & 0x7F;
            const result = cpu.getGeneralRegister(Reg.SP) - (imm << 2);
            cpu.setGeneralRegister(Reg.SP, result);
        }
    }

    return { incrementPC: true };
}

const processTST = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('TST');

    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    const aluOut = cpu.getGeneralRegister(rn) & cpu.getGeneralRegister(rm);
    cpu.setStatusRegisterFlag('n', (aluOut >>> 31) & 0x1);
    cpu.setStatusRegisterFlag('z', aluOut === 0 ? 1 : 0);

    return { incrementPC: true };
}

// load / Store Instructions

const processLDR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDR (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + (imm * 4);
            if ((address & 0x3) === 0) {
                const data = cpu.getBytesFromMemory(address, 4);
                cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            } else {
                cpu.history.currentLog.errors.push(`LDR (1) address 0x${address.toString(16).padStart(8, '0')} is not word aligned.`);
            }
            break;
        }
        case 2: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
            if ((address & 0x3) === 0) {
                const data = cpu.getBytesFromMemory(address, 4);
                cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            } else {
                cpu.history.currentLog.errors.push(`LDR (2) address 0x${address.toString(16).padStart(8, '0')} is not word aligned.`);
            }
            break;
        }
        case 3: {
            const rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            const pc = cpu.getGeneralRegister(Reg.PC);
            const address = ((pc & ~(0b11)) << 2) + (imm + 4);
            const data = cpu.getBytesFromMemory(address, 4);
            cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            break;
        }
        case 4: {
            const rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            const sp = cpu.getGeneralRegister(Reg.SP);
            const address = sp + (imm * 4);
            if ((address & 0x3) === 0) {
                const data = cpu.getBytesFromMemory(address, 4);
                cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            } else {
                cpu.history.currentLog.errors.push(`LDR (4) address 0x${address.toString(16).padStart(8, '0')} is not word aligned.`);
            }
        }
    }

    return { incrementPC: true };
}

const processLDRB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDRB (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + imm;
            const data = cpu.getBytesFromMemory(address, 1);
            cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            break;
        }
        case 2: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
            const data = cpu.getBytesFromMemory(address, 1);
            cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            break;
        }
    }

    return { incrementPC: true };
}

const processLDRH = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDRH (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + (imm * 2);
            if ((address & 0x1) === 0) {
                const data = cpu.getBytesFromMemory(address, 2);
                cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            } else {
                cpu.history.currentLog.errors.push(`LDRH (1) address 0x${address.toString(16).padStart(8, '0')} is not half-word aligned.`);
            }
            break;
        }
        case 2: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
            if ((address & 0x1) === 0) {
                const data = cpu.getBytesFromMemory(address, 2);
                cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
            } else {
                cpu.history.currentLog.errors.push(`LDRH (2) address 0x${address.toString(16).padStart(8, '0')} is not half-word aligned.`);
            }
            break;
        }
    }

    return { incrementPC: true };
}

const processLDRSB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRSB');

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    const data = cpu.getBytesFromMemory(address, 1);
    cpu.setGeneralRegister(rd, signExtend(data[0], 1));

    return { incrementPC: true };
}

const processLDRSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRSH');

    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
    if ((address & 0x1) === 0) {
        const data = cpu.getBytesFromMemory(address, 2);
        cpu.setGeneralRegister(rd, byteArrayToInt32(data, cpu.bigEndian));
    } else {
        cpu.history.currentLog.errors.push(`LDRSH address 0x${address.toString(16).padStart(8, '0')} is not half-word aligned.`);
    }

    return { incrementPC: true };
}

const processSTR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STR (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + (imm * 4);
            if ((address & 0x11) === 0) {
                const data = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
                cpu.setBytesInMemory(address, data);
            } else {
                cpu.history.currentLog.errors.push(`STR (1) address 0x${address.toString(16).padStart(8, '0')} is not word aligned.`);
            }
            break;
        }
        case 2: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
            if ((address & 0x11) === 0) {
                const data = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
                cpu.setBytesInMemory(address, data);
            } else {
                cpu.history.currentLog.errors.push(`STR (1) address 0x${address.toString(16).padStart(8, '0')} is not word aligned.`);
            }
            break;
        }
        case 3: {
            const rd = (i >>> 8) & 0x7;
            const imm = i & 0xFF;
            const sp = cpu.getGeneralRegister(Reg.SP);
            const address = sp + (imm * 4);
            if ((address & 0x11) === 0) {
                const data = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
                cpu.setBytesInMemory(address, data);
            } else {
                cpu.history.currentLog.errors.push(`STR (1) address 0x${address.toString(16).padStart(8, '0')} is not word aligned.`);
            }
            break;
        }
    }

    return { incrementPC: true };
}

const processSTRB = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STRB (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + imm;
            const data = int8ToByteArray((rd & 0xF), cpu.bigEndian);
            cpu.setBytesInMemory(address, data);
            break;
        }
        case 2: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
            const data = int8ToByteArray((rd & 0xF), cpu.bigEndian);
            cpu.setBytesInMemory(address, data);
            break;
        }
    }

    return { incrementPC: true };
}

const processSTRH = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STRH (${type})`);

    switch (type) {
        case 1: {
            const imm = (i >>> 6) & 0x1F;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + (imm * 2);
            if ((address & 0x3) === 0) {
                const data = int16ToByteArray((rd & 0xFF), cpu.bigEndian);
                cpu.setBytesInMemory(address, data);
            } else {
                cpu.history.currentLog.errors.push(`STRH (1) address 0x${address.toString(16).padStart(8, '0')} is not half-word aligned.`);
            }
            break;
        }
        case 2: {
            const rm = (i >>> 6) & 0x7;
            const rn = (i >>> 3) & 0x7;
            const rd = i & 0x7;
            const address = cpu.getGeneralRegister(rn) + cpu.getGeneralRegister(rm);
            if ((address & 0x3) === 0) {
                const data = int16ToByteArray((rd & 0xFF), cpu.bigEndian);
                cpu.setBytesInMemory(address, data);
            } else {
                cpu.history.currentLog.errors.push(`STRH (1) address 0x${address.toString(16).padStart(8, '0')} is not half-word aligned.`);
            }
            break;
        }
    }

    return { incrementPC: true };
}

// Load / Store Multiple Instructions

const processLDMIA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDMIA');

    const rn = (i >>> 8) & 0x7;
    const regList = i & 0xFF;
    const startAddress = cpu.getGeneralRegister(rn);
    const endAddress = cpu.getGeneralRegister(rn) + (numberOfSetBits(regList) * 4) - 4;
    let address = startAddress;
    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            let data = cpu.getBytesFromMemory(address, 4);
            cpu.setGeneralRegister(i, byteArrayToInt32(data, cpu.bigEndian));
            address += 4;
        }
    }

    if (address - 4 !== endAddress) {
        cpu.history.currentLog.errors.push(`Final address of 0x${address.toString(16).padStart(8, '0')} != expected end address 0x${endAddress.toString(16).padStart(8, '0')}`);
    }

    const rnValue = cpu.getGeneralRegister(rn);
    cpu.setGeneralRegister(rn, rnValue + (numberOfSetBits(regList) * 4));

    return { incrementPC: true };
}

const processPOP = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('POP');

    const r = (i >>> 8) & 0x1;
    const regList = i & 0xFF;
    const sp = cpu.getGeneralRegister(Reg.SP);
    const startAddress = sp;
    const endAddress = sp + 4 * (r + numberOfSetBits(regList));
    let address = startAddress;

    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            const data = cpu.getBytesFromMemory(address, 4);
            cpu.setGeneralRegister(i, byteArrayToInt32(data, cpu.bigEndian));
            address += 4;
        }
    }

    if (r === 1) {
        const value = cpu.getBytesFromMemory(address, 4);
        const newPC = byteArrayToInt32(value, cpu.bigEndian) & 0xFFFFFFFE;
        cpu.setGeneralRegister(Reg.PC, newPC);
        address += 4;
    }

    if (endAddress !== address) {
        cpu.history.currentLog.errors.push(`End address ${asHex(address)} != expected end address ${asHex(endAddress)}.`);
    }

    cpu.setGeneralRegister(Reg.SP, endAddress);

    return { incrementPC: r !== 1 };
}

const processPUSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('PUSH');

    const r = (i >>> 8) & 0x1;
    const regList = i & 0xFF;
    const sp = cpu.getGeneralRegister(Reg.SP);
    const startAddress = sp - 4 * (r + numberOfSetBits(regList));
    const endAddress = sp - 4;
    let address = startAddress;

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

    if (endAddress !== address) {
        cpu.history.currentLog.errors.push(`Ending address ${asHex(address)} != expected (end address - 4) ${asHex(endAddress - 4)}.`);
    }

    cpu.setGeneralRegister(Reg.SP, sp - 4 * (r + numberOfSetBits(regList)));

    return { incrementPC: true };
}

const processSTMIA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STMIA');

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
    cpu.history.currentLog.errors.push('Not implemented.');
    return { incrementPC: true };
}

const processSWI = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SWI');
    cpu.history.currentLog.errors.push('Not implemented.');
    return { incrementPC: true };
}



export { processTHUMB }