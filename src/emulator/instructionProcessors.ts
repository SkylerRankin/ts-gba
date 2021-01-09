import { CPU, Reg } from './cpu';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight } from './math';

type DataProcessingFunction = (param: DataProcessingParameter) => number
type DataProcessingParameter = {
    cpu: CPU,
    value1: number,
    value2: number,
    rd: number,
    sFlag: number, // True if instruction should set condition flags
    shiftCarry: number
}

const process = (cpu: CPU, i: number) : void => {

    const bits = (i >>> 0).toString(2).padStart(32, '0')
        .split('').map((x: string) : number => parseInt(x)).reverse();

    // Branch instructions
    if (((i >>> 4) & 0xFFFFFF) === 0x12FFF1) return processBX(cpu, i);
    if (((i >>> 25) & 0x7F) === 0x7D) return processBLX(cpu, i, 1);
    if (((i >>> 4) & 0xFFFFFF) === 0x12FFF3) return processBLX(cpu, i, 2);
    // Check for B/BL after BLX(1) due to overlap in bits 27:25
    if (((i >>> 25) & 0x7) === 0x5) return processBBL(cpu, i);

    // Load/store instructions
    if (((i >>> 26) & 0x3) === 0x1) {
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0x7) return processLDRBT(cpu, i);
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0x3) return processLDRT(cpu, i);
        if (bits[22] === 0 && bits[20] === 1) return processLDR(cpu, i);
        if (bits[22] === 1 && bits[20] === 1) return processLDRB(cpu, i);
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0b110) return processSTRBT(cpu, i);
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0b010) return processSTRT(cpu, i);
        if (bits[22] === 0 && bits[20] === 0) return processSTR(cpu, i);
        if (bits[22] === 1 && bits[20] === 0) return processSTRB(cpu, i);
    } else if (((i >>> 25) & 0x7) === 0x0 && bits[20] === 1) {
        if (((i >>> 4) & 0xF) === 0xB) return processLDRH(cpu, i);
        if (((i >>> 4) & 0xF) === 0xD) return processLDRSB(cpu, i);
        if (((i >>> 4) & 0xF) === 0xF) return processLDRSH(cpu, i);
    } else if (((i >>> 25) & 0x7) === 0x4) {
        if (bits[22] === 0 && bits[20] === 1) return processLDM(cpu, i, 1);
        if (((i >>> 20) & 0x7) === 0x5 && bits[15] === 0) return processLDM(cpu, i, 2);
        if (bits[22] === 1 && bits[20] === 1 && bits[15] === 1) return processLDM(cpu, i, 3);
    }

    // Coprocessor Load & Store
    if (((i >>> 25) & 0x7) === 0b110) {
        if (bits[20] === 1) return processLDC(cpu, i);
        if (bits[20] === 1) return processSTC(cpu, i);
    }

    // Coprocessor Data Processing and Register Transfers
    if (((i >>> 24) & 0xF) === 0b1110) {
        if (bits[4] === 0) return processCDP(cpu, i);
        else if (bits[20] === 0) return processMCR(cpu, i);
        else return processMRC(cpu, i);
    }

    // Software Interrupt
    if (((i >>> 24) & 0xF) === 0xF) return processSWI(cpu, i);

    // Breakpoint
    if (((i >>> 20) & 0xFFF) === 0b111000010010 && ((i >>> 4) & 0xF) === 0b0111) return processBKPT(cpu, i);

    // MRS and MSR
    if (((i >>> 23) & 0x1F) === 0b00010 && ((i >>> 16) & 0x3F) === 0xF && (i & 0xFFF) === 0x0) {
        return processMRS(cpu, i);
    }
    if (((i >>> 23) & 0x1F) === 0b00110 && ((i >>> 20) & 0x3) === 0x2 && ((i >>> 12) & 0xF) === 0xF) {
        return processMSR(cpu, i, 1);
    } else if (((i >>> 23) & 0x1F) === 0b00010 && ((i >>> 20) & 0x3) === 0x2 && ((i >>> 4) & 0xFFF) === 0b111100000000) {
        return processMSR(cpu, i, 2);
    }

    // Bits 27:25 = 000
    if (((i >>> 25) & 0x7) === 0x0) {
        // Store Register Halfword
        if (bits[20] === 0 && ((i >>> 4) & 0xF) === 0b1011) return processSTRH(cpu, i);

        // Multiply Instructions
        if (((i >>> 21) & 0x7F) === 0x1 && ((i >>> 4) & 0xF) === 0b1001) return processMLA(cpu, i);
        if (((i >>> 21) & 0x7F) === 0x0 && ((i >>> 12) & 0xF) === 0x0 && ((i >>> 4) & 0xF) === 0b1001) return processMUL(cpu, i);
        if (((i >>> 23) & 0x1F) === 0x1 && ((i >>> 4) & 0xF) === 0b1001) {
            if (bits[22] === 0) {
                if (bits[21] === 0) {
                    return processUMULL(cpu, i);
                } else {
                    return processUMLAL(cpu, i);
                }
            } else {
                if (bits[21] === 0) {
                    return processSMULL(cpu, i);
                } else {
                    return processSMLAL(cpu, i);
                }
            }
        }

        // Swaps
        if (((i >>> 20) & 0xFF) === 0b00010000 && ((i >>> 4) & 0xFF) === 0b00001001) return processSWP(cpu, i);
        if (((i >>> 20) & 0xFF) === 0b00010100 && ((i >>> 4) & 0xF) === 0b1001) return processSWPB(cpu, i);
    }

    // Store Multiple
    if (((i >>> 25) & 0x7) === 0x4 && bits[22] === 0 && bits[20] === 0) return processSTM(cpu, i, 1);
    if (((i >>> 25) & 0x7) === 0x4 && bits[22] === 1 && bits[20] === 0) return processSTM(cpu, i, 2);

    // CLZ
    if (((i >>> 16) & 0xFFF) === 0b000101101111 && ((i >>> 4) & 0xFF) === 0b11110001) return processCLZ(cpu, i);

    // Data processing instructions
    if ((i & 0x0C000000) === 0) return processDataProcessing(cpu, i);
}

const processDataProcessing = (cpu: CPU, i: number) : void => {
    const opcode = (i >>> 21) & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const iFlag = (i >>> 25) & 0x1;
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;

    const value1 = cpu.getGeneralRegister(rn);
    const [value2, shiftCarry] = getShiftOperandValue(cpu, i, iFlag);
    let processingFunction: DataProcessingFunction | undefined;
    switch(opcode) {
        case 0b0000: processingFunction = processAnd; break;
        case 0b0001: processingFunction = processEor; break;
        case 0b0010: processingFunction = processSub; break;
        case 0b0011: processingFunction = processRsb; break;
        case 0b0100: processingFunction = processAdd; break;
        case 0b0101: processingFunction = processAdc; break;
        case 0b0110: processingFunction = processSbc; break;
        case 0b0111: processingFunction = processRsc; break;
        case 0b1000: processingFunction = processTst; break;
        case 0b1001: processingFunction = processTeq; break;
        case 0b1010: processingFunction = processCmp; break;
        case 0b1011: processingFunction = processCmn; break;
        case 0b1100: processingFunction = processOrr; break;
        case 0b1101: processingFunction = processMov; break;
        case 0b1110: processingFunction = processBic; break;
        case 0b1111: processingFunction = processMvn; break;
    }
    if (processingFunction) {
        processingFunction({cpu, value1, value2, rd, sFlag, shiftCarry});
    }
}

/**
 * This returns an array [value, carry].
 * Some instructions set the carry condition flag based on the shifting
 * in the shift operand, so it is returned along with the value.
 */
const getShiftOperandValue = (cpu: CPU, i: number, iFlag: number) : number[] => {
    let value = 0;
    let carry = 0;
    const cFlag = (cpu.getStatusRegister('CPSR') >>> 28) & 0x1;

    if (iFlag) {
        const rotate = (i >>> 8) & 0xF;
        const imm = i & 0xFF;
        value = rotateRight(imm, rotate * 2, 32);
        carry = rotate === 0 ?
            cFlag :
            (value >>> 31) & 0x1;
    } else {
        const rm = i & 0xF;
        const shiftType = (i >>> 5) & 0x3;
        // 4th bit is 0 for immediate shifts, 1 for register shifts.
        const shiftOpcode = (i >>> 4) & 0x1;
        let shiftAmount = 0;
        if (shiftOpcode === 1) {
            // Rm shifted by register value
            const rs = (i >>> 8) & 0xF;
            shiftAmount = cpu.getGeneralRegister(rs);
        } else {
            // Rm shifted by immediate value
            const imm = (i >>> 7) & 0x1F;
            shiftAmount = imm;
        }

        switch (shiftType) {
            case 0x0:
                // Logical shift left
                [value, carry] = logicalShiftLeft(cpu.getGeneralRegister(rm), shiftAmount);
                break;
            case 0x1:
                // Logical shift right
                [value, carry] = logicalShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
                break;
            case 0x2:
                // Arithmetic shift right
                [value, carry] = arithmeticShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
                break;
            case 0x3:
                // Rotate right
                value = rotateRight(cpu.getGeneralRegister(rm), shiftAmount, 32);
                break;
            default:
                console.log(`InstructionProcessor.getShiftOperandValue: illegal shiftType ${shiftType.toString(2)} from instruction ${i.toString(16)}`);
        }
    }

    return [value, carry];
}

// Data Processing Functions

const processAnd = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('AND');
    cpu.updateGeneralRegister(rd, value1 & value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.cpsrToSPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setConditionCodeFlags('z');
            if (result < 0) cpu.setConditionCodeFlags('n');
            if (shiftCarry === 1) cpu.setConditionCodeFlags('c');
        }
    }
    return result;
}

const processEor = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('EOR');
    cpu.updateGeneralRegister(rd, value1 ^ value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.cpsrToSPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setConditionCodeFlags('z');
            if (result < 0) cpu.setConditionCodeFlags('n');
            if (shiftCarry === 1) cpu.setConditionCodeFlags('c');
        }
    }
    return result;
}

const processSub = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('SUB');
    cpu.updateGeneralRegister(rd, value1 - value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');

        // TODO handle underflows, not overflows ------------------------------------------------------------- !!!

        // Unsigned overflow
        if (result < 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if (value1MSB !== value2MSB && value1MSB !== resultMSB) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processRsb = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    cpu.pushToHistory('RSB');
    cpu.updateGeneralRegister(rd, value2 - value1);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result < 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if (value1MSB !== value2MSB && value2MSB !== resultMSB) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processAdd = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    cpu.pushToHistory('ADD');
    cpu.updateGeneralRegister(rd, (value1 + value2) & 0xFFFFFFFF);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result > 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processAdc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getConditionCodeFlag('c');
    cpu.pushToHistory('ADC');
    cpu.updateGeneralRegister(rd, (value1 + value2 + cFlag) & 0xFFFFFFFF);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result > 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processSbc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getConditionCodeFlag('c');
    cpu.pushToHistory('SBC');
    cpu.updateGeneralRegister(rd, (value1 - value2 - cFlag) & 0xFFFFFFFF);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result > 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processRsc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getConditionCodeFlag('c');
    cpu.pushToHistory('RSC');
    cpu.updateGeneralRegister(rd, (value2 - value1 - cFlag) & 0xFFFFFFFF);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result > 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processTst = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag, shiftCarry} = data;
    cpu.pushToHistory('TST');
    const aluOut = value1 & value2;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (aluOut < 0) cpu.setConditionCodeFlags('n');
        if (aluOut === 0) cpu.setConditionCodeFlags('z');
        if (shiftCarry) cpu.setConditionCodeFlags('c');
    }
    return 0;
}

const processTeq = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag, shiftCarry} = data;
    cpu.pushToHistory('TEQ');
    const aluOut = value1 ^ value2;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (aluOut < 0) cpu.setConditionCodeFlags('n');
        if (aluOut === 0) cpu.setConditionCodeFlags('z');
        if (shiftCarry) cpu.setConditionCodeFlags('c');
    }
    return 0;
}

const processCmp = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag} = data;
    cpu.pushToHistory('CMP');
    const aluOut = value1 - value2;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (aluOut < 0) cpu.setConditionCodeFlags('n');
        if (aluOut === 0) cpu.setConditionCodeFlags('z');
        // Unsigned overflow
        if (aluOut > 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed Overflow
        const resultMSB = (aluOut >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if (value1MSB === value2MSB && value1MSB !== resultMSB) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return 0;
}

const processCmn = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag} = data;
    cpu.pushToHistory('CMN');
    const aluOut = value1 + value2;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (aluOut < 0) cpu.setConditionCodeFlags('n');
        if (aluOut === 0) cpu.setConditionCodeFlags('z');
        // Unsigned overflow
        if (aluOut > 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed Overflow
        const resultMSB = (aluOut >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if (value1MSB === value2MSB && value1MSB !== resultMSB) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return 0;
}

const processOrr = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('ORR');
    cpu.updateGeneralRegister(rd, value1 | value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.cpsrToSPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setConditionCodeFlags('z');
            if (result < 0) cpu.setConditionCodeFlags('n');
            if (shiftCarry === 1) cpu.setConditionCodeFlags('c');
        }
    }
    return result;
}

const processMov = (data: DataProcessingParameter) : number => {
    const {cpu, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('MOV');
    cpu.updateGeneralRegister(rd, value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.cpsrToSPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setConditionCodeFlags('z');
            if (result < 0) cpu.setConditionCodeFlags('n');
            if (shiftCarry === 1) cpu.setConditionCodeFlags('c');
        }
    }
    return result;
}

const processBic = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('BIC');
    cpu.updateGeneralRegister(rd, value1 & (~value2));
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.cpsrToSPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setConditionCodeFlags('z');
            if (result < 0) cpu.setConditionCodeFlags('n');
            if (shiftCarry === 1) cpu.setConditionCodeFlags('c');
        }
    }
    return result;
}

const processMvn = (data: DataProcessingParameter) : number => {
    const {cpu, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('MVN');
    cpu.updateGeneralRegister(rd, ~value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.cpsrToSPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setConditionCodeFlags('z');
            if (result < 0) cpu.setConditionCodeFlags('n');
            if (shiftCarry === 1) cpu.setConditionCodeFlags('c');
        }
    }
    return result;
}

// Branch Instructions

const processBBL = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('BBL');
    const lFlag = (i >>> 24) & 0x1;
    let imm = i & 0xFFFFFF;
    if (((imm >>> 23) & 0x1) === 1) imm += 0xFF000000;
    imm = imm << 2;
    const pc = cpu.getGeneralRegister(Reg.PC);
    cpu.updateGeneralRegister(Reg.PC, pc + imm);
    if (lFlag) {
        const instructionSize = cpu.operatingState === 'ARM' ? 4 : 2;
        cpu.updateGeneralRegister(Reg.LR, pc + instructionSize);
    }
}

const processBLX = (cpu: CPU, i: number, type: number) : void => {
    cpu.pushToHistory(`BLX (${type})`);

}

const processBX = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('BX');
    const rm = i & 0xF;
    const pc = rm & 0xFFFFFFFE;
    // cpu.updateStatusRegister();
    cpu.updateGeneralRegister(Reg.PC, pc);
}

// Load & Store Instructions

const processLDR = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDR');
}

const processLDRB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRB');
}

const processLDRBT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRBT');
}

const processLDRH = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRH');
}

const processLDRSB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRSB');
}

const processLDRSH = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRSH');
}

const processLDRT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRT');
}

const processSTR = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STR');
}

const processSTRB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRB');
}

const processSTRBT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRBT');
}

const processSTRH = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRH');
}

const processSTRT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRT');
}

// Load & Store Multiple Instructions

const processLDM = (cpu: CPU, i: number, type: number) : void => {
    cpu.pushToHistory(`LDM (${type})`);
}

const processSTM = (cpu: CPU, i: number, type: number) : void => {
    cpu.pushToHistory(`STM (${type})`);
}

// Multiply Instructions

const processMUL = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('MUL');
}

const processMLA = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('MLA');
}

const processSMULL = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('SMULL');
}

const processUMULL = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('UMULL');
}

const processSMLAL = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('SMLAL');
}

const processUMLAL = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('UMLAL');
}

// Miscellaneous Arithmetic Instructions

 const processCLZ = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('CLZ');
 }

 // Status Register Instructions

const processMRS = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('MRS');
}

// type = 1 => immediate operand, 2 => register operand
const processMSR = (cpu: CPU, i: number, type: number) : void => {
    cpu.pushToHistory(`MSR`);
}

// Semaphore Instructions

const processSWP = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('SWP');
}

const processSWPB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('SWPB');
}

// Exception Generating Instructions

const processBKPT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('BKPT');
}

const processSWI = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('SWI');
}

// Co-Processor Instructions

const processCDP = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('CDP');
}

const processLDC = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDC');
}

const processMCR = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('MCR');
}

const processMRC = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('MRC');
}

const processSTC = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STC');
}

export { process }
