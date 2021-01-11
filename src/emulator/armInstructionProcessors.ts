import { start } from 'repl';
import { CPU, Reg } from './cpu';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight, byteArrayToInt32, signExtend, int32ToByteArray, numberOfSetBits } from './math';

type DataProcessingFunction = (param: DataProcessingParameter) => number
type DataProcessingParameter = {
    cpu: CPU,
    value1: number,
    value2: number,
    rd: number,
    sFlag: number, // True if instruction should set condition flags
    shiftCarry: number
}

const processARM = (cpu: CPU, i: number) : void => {

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
 * Addressing Mode 1
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

/**
 * Addressing Mode 2 and 3
 * Decodes an address for load and store instructions to access memory.
 * Relied on register Rn at bits 19:16.
 * 
 * Addressing Mode 2
 * 01 I PUBWL
 * 01 0 1UB0L - Immediate offset
 * 01 1 1UB0L - Register offset
 * 01 1 1UB0L - Scaled register offset
 * 01 0 1UB1L - Immediate pre-indexed
 * 01 1 1UB1L - Register pre-index
 * 01 1 1UB1L - Scaled register pre-indexed
 * 01 0 0UB0L - Immediate post-indexed
 * 01 1 0UB0L - Register post-indexed
 * 01 1 0UB0L - Scaled register post-indexed

 * Addressing Mode 3
 * 00 0 PUBWL
 * 00 0 1U10L - Immediate offset
 * 00 0 1U00L - Register offset
 * 00 0 1U11L - Immediate pre-indexed
 * 00 0 1U01L - Register pre-indexed
 * 00 0 0U10L - Immediate post-indexed
 * 00 0 0U00L - Register post-indexed
 * 
 */
const getLoadStoreAddress = (cpu: CPU, i: number) : number => {
    const bits = (i >>> 0).toString(2).padStart(32, '0')
        .split('').map((x: string) : number => parseInt(x)).reverse();
    const mode = ((i >>> 26) & 0x3) === 0x1 ? 2 : 3;
    const p = bits[24];
    const u = bits[23];
    const b = bits[22];
    const w = bits[21];
    const l = bits[20];
    const rn = (i >>> 16) & 0xF;
    const rnValue = cpu.getGeneralRegister(rn);
    let address = 0;

    if (mode === 2) {
        const immediate = bits[25] === 0;
        if (immediate) {
            const offset = i & 0xFFF;
            const sign = u === 1 ? 1 : -1;
            
            if (p === 1 && w === 0) {
                // Immediate offset; does not set Rn
                address = rnValue + sign * offset;
            } else if (p === 1 && w === 1) {
                // Immediate pre-indexed
                address = rnValue + sign * offset;
                cpu.setGeneralRegister(rn, address);
            } else if (p === 0 && w === 0) {
                // Immediate post-indexed
                address = rnValue;
                cpu.setGeneralRegister(rn, rnValue + sign * offset);
            }
        } else {
            const sign = u === 1 ? 1 : -1;
            const shiftImmediate = (i >>> 7) & 0xF;
            const shiftType = (i >>> 5) & 0x3;
            const rm = i & 0xF;
            const rmValue = cpu.getGeneralRegister(rm);
            const cFlag = 0;
            let index = 0;

            switch (shiftType) {
                case 0b00:
                    // LSL
                    [index] = logicalShiftLeft(rmValue, shiftImmediate);
                    break;
                case 0b01:
                    // LSR
                    if (shiftImmediate !== 0) {
                        [index] = logicalShiftRight(rmValue, shiftImmediate);
                    }
                    break;
                case 0b10:
                    // ASR
                    if (shiftImmediate === 0 && rmValue < 0) {
                        index = 0xFFFFFFFF;
                    } else if (shiftImmediate !== 0) {
                        [index] = arithmeticShiftRight(rmValue, shiftImmediate);
                    }
                    break;
                case 0b11:
                    // ROR/RRX
                    if (shiftImmediate === 0) {
                        index = logicalShiftLeft(cFlag, 31)[0] | logicalShiftRight(rmValue, 1)[0];
                    } else {
                        index = rotateRight(rmValue, shiftImmediate, 32);
                    }
                    break;
            }

            if (p === 1 && w === 0) {
                // Register offset; does not set Rn
                address = rnValue + sign * index;
            } else if (p === 1 && w === 1) {
                // Register pre-indexed
                address = rnValue + sign * index;
                cpu.setGeneralRegister(rn, address);
            } else if (p === 0 && w === 0) {
                // Register post-indexed
                address = rnValue;
                cpu.setGeneralRegister(rn, rnValue + sign * index);
            }
        }
    } else if (mode === 3) {
        const immediate = bits[22] === 1;
        const sign = u === 1 ? 1 : -1;
        let offset = 0;
        if (immediate) {
            const immediateHigh = (i >>> 8) & 0xF;
            const immediateLow = i & 0xF;
            offset = (immediateHigh << 4) | immediateLow;
        } else {
            const rm = i & 0xF;
            offset = cpu.getGeneralRegister(rm);
        }

        if (p === 1 && w === 0) {
            // Offset; does not change base register
            address = rnValue + sign * offset;
        } else if (p === 1 && w === 1) {
            // Pre-indexed
            address = rnValue + sign * offset;
            cpu.setGeneralRegister(rn, address);
        } else if (p === 0 && w === 0) {
            // Post-indexed
            address = rnValue;
            cpu.setGeneralRegister(rn, rnValue + sign * offset);
        }
    }

    return address;
}

/**
 * Addressing Mode 4
 * Returns an array [startAddress, endAddress], marking the start and end
 * addresses to read/set a series of values in memory.
 */
const getLoadStoreMultipleAddress = (cpu: CPU, i: number) : number[] => {
    const opcode = (i >>> 23) & 0x3;
    const w = (i >>> 21) & 0x1;
    const regList = i & 0xFFFF;
    const rn = (i >>> 16) & 0xF;
    const bitsSet = numberOfSetBits(regList);
    let rnValue = cpu.getGeneralRegister(rn);
    let startAddress = 0;
    let endAddress = 0;
    switch (opcode) {
        case 0b00:
            // Decrement After
            startAddress = rnValue - (bitsSet * 4) + 4;
            endAddress = rnValue;
            if (w === 1) {
                rnValue -= (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
        case 0b01:
            // Increment After
            startAddress = rnValue;
            endAddress = rnValue + (bitsSet * 4) - 4
            if (w === 1) {
                rnValue += (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
        case 0b10:
            // Decrement Before
            startAddress = rnValue - (bitsSet * 4);
            endAddress - rnValue - 4;
            if (w === 1) {
                rnValue -= (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
        case 0b11:
            // Increment Before
            startAddress = rnValue + 4;
            endAddress = rnValue + (bitsSet * 4);
            if (w === 1) {
                rnValue += (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
    }
    return [startAddress, endAddress];
}

// Data Processing Functions

const processAnd = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.pushToHistory('AND');
    cpu.setGeneralRegister(rd, value1 & value2);
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
    cpu.setGeneralRegister(rd, value1 ^ value2);
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
    cpu.setGeneralRegister(rd, value1 - value2);
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
    cpu.setGeneralRegister(rd, value2 - value1);
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
    cpu.setGeneralRegister(rd, (value1 + value2) & 0xFFFFFFFF);
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
    cpu.setGeneralRegister(rd, (value1 + value2 + cFlag) & 0xFFFFFFFF);
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
    cpu.setGeneralRegister(rd, (value1 - value2 - cFlag) & 0xFFFFFFFF);
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
    cpu.setGeneralRegister(rd, (value2 - value1 - cFlag) & 0xFFFFFFFF);
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
    cpu.setGeneralRegister(rd, value1 | value2);
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
    cpu.setGeneralRegister(rd, value2);
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
    cpu.setGeneralRegister(rd, value1 & (~value2));
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
    cpu.setGeneralRegister(rd, ~value2);
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
    cpu.setGeneralRegister(Reg.PC, pc + imm);
    if (lFlag) {
        const instructionSize = cpu.operatingState === 'ARM' ? 4 : 2;
        cpu.setGeneralRegister(Reg.LR, pc + instructionSize);
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
    cpu.setGeneralRegister(Reg.PC, pc);
}

// Load & Store Instructions

const processLDR = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDR');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = cpu.getBytesFromMemory(address, 4);
    let value = byteArrayToInt32(bytes, cpu.bigEndian);
    switch (address & 0x3) {
        case 0b01: value = rotateRight(value, 8, 32); break;
        case 0b10: value = rotateRight(value, 16, 32); break;
        case 0b11: value = rotateRight(value, 24, 32); break;
    }

    if (rd === 15) {
        const pc = cpu.getGeneralRegister(Reg.PC);
        const newPC = pc & 0xFFFFFFFC;
        cpu.setGeneralRegister(Reg.PC, newPC);
    } else {
        cpu.setGeneralRegister(rd, value);
    }
}

const processLDRB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRB');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = cpu.getBytesFromMemory(address, 1)[0];
    cpu.setGeneralRegister(rd, value);
}

const processLDRBT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRBT');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = cpu.getBytesFromMemory(address, 1)[0];
    cpu.setGeneralRegister(rd, value);
}

const processLDRH = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRH');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = cpu.getBytesFromMemory(address, 2);
    const value = byteArrayToInt32(bytes, cpu.bigEndian);
    cpu.setGeneralRegister(rd, value);
}

const processLDRSB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRSB');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = signExtend(cpu.getBytesFromMemory(address, 1)[0], 8);
    cpu.setGeneralRegister(rd, value);
}

const processLDRSH = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRSH');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = signExtend(cpu.getBytesFromMemory(address, 2)[0], 16);
    cpu.setGeneralRegister(rd, value);
}

const processLDRT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('LDRT');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = cpu.getBytesFromMemory(address, 4);
    let value = byteArrayToInt32(bytes, cpu.bigEndian);
    switch (address & 0x3) {
        case 0b01: value = rotateRight(value, 8, 32); break;
        case 0b10: value = rotateRight(value, 16, 32); break;
        case 0b11: value = rotateRight(value, 24, 32); break;
    }
    cpu.setGeneralRegister(rd, value);
}

const processSTR = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STR');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(address, bytes);
}

const processSTRB = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRB');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([cpu.getGeneralRegister(rd) & 0xFF]);
    cpu.setBytesInMemory(address, bytes);
}

const processSTRBT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRBT');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([cpu.getGeneralRegister(rd) & 0xFF]);
    cpu.setBytesInMemory(address, bytes);
}

const processSTRH = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRH');
    const rd = (i >>> 12) & 0xF;
    const rdValue = cpu.getGeneralRegister(rd);
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([rdValue & 0xFF, (rdValue >> 8) & 0xFF]);
    if (cpu.bigEndian) bytes.reverse();
    cpu.setBytesInMemory(address, bytes);
}

const processSTRT = (cpu: CPU, i: number) : void => {
    cpu.pushToHistory('STRT');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(address, bytes);
}

// Load & Store Multiple Instructions

const processLDM = (cpu: CPU, i: number, type: number) : void => {
    cpu.pushToHistory(`LDM (${type})`);
    const [startAddress, endAddress] = getLoadStoreMultipleAddress(cpu, i);
    const regList = (i & 0xFFFF);
    const bitsSet = numberOfSetBits(regList);
    let address = startAddress;

    switch (type) {
        case 1:
            for (let i = 0; i <= 14; i++) {
                if (((bitsSet >>> i) & 0x1) === 1) {
                    const riValue = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                    cpu.setGeneralRegister(i, riValue);
                }
            }
            if (((bitsSet >>> 15) & 0x1) === 1) {
                const value = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                const newPC = value & 0xFFFFFFFC;
                cpu.setGeneralRegister(Reg.PC, newPC);
                address += 4;
            }

            
            break;
        case 2:
            for (let i = 0; i <= 14; i++) {
                if (((bitsSet >>> i) & 0x1) === 1) {
                    const riValue = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                    cpu.setGeneralRegisterByMode(i, riValue, 'usr');
                    address += 4;
                }
            }
            break;
        case 3:
            for (let i = 0; i <= 14; i++) {
                if (((bitsSet >>> i) & 0x1) === 1) {
                    const riValue = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                    cpu.setGeneralRegisterByMode(i, riValue, 'usr');
                    address += 4;
                }
            }
            cpu.cpsrToSPSR();
            const value = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
            const t = cpu.getStatusRegisterFlag('t');
            const newPC = t === 1 ?
                value & 0xFFFFFFFE :
                value & 0xFFFFFFFC;
            cpu.setGeneralRegister(Reg.PC, newPC);
            address += 4;
            break;
    }

    if (address - 4 !== endAddress) {
        console.error(`LDM (${type}) failure: address ${address} does not match expected end address ${endAddress}`);
    }
}

const processSTM = (cpu: CPU, i: number, type: number) : void => {
    cpu.pushToHistory(`STM (${type})`);
    const [startAddress, endAddress] = getLoadStoreMultipleAddress(cpu, i);
    const regList = i & 0xFFFF;
    let address = startAddress;
    for (let i = 0; i <= 15; i++) {
        if (((regList >> i) & 0x1) === 1) {
            const riValue = type === 1 ?
                cpu.getGeneralRegister(i) :
                cpu.getGeneralRegisterByMode(i, 'usr');
            const bytes = int32ToByteArray(riValue, cpu.bigEndian);
            cpu.setBytesInMemory(address, bytes);
            address += 4;
        }
    }
    if (endAddress !== address - 4) {
        console.error(`STM failure: address ${address} does not match expected end address ${endAddress}`);
    }
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

export { processARM }
