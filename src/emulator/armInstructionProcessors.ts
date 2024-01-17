import { CPU, Reg } from './cpu';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight, byteArrayToInt32, signExtend, int32ToByteArray, numberOfSetBits, isNegative32, borrowFrom, signedOverflowFromSubtraction, value32ToNative, wordAlignAddress, int8ToByteArray, halfWordAlignAddress } from './math';

type ProcessedInstructionOptions = {
    incrementPC: boolean
};
type DataProcessingFunction = (param: DataProcessingParameter) => number
type DataProcessingParameter = {
    cpu: CPU,
    value1: number,
    value2: number,
    rd: number,
    sFlag: number, // True if instruction should set condition flags
    shiftCarry: number
}

/**
 * Takes a 32 bit ARM instruction in big-endian format, and executes that instruction
 * on the given CPU.
 */
const processARM = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
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
        if (bits[20] === 0) return processSTC(cpu, i);
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

    throw Error(`Failed to decode instruction: 0x${i.toString(16).padStart(8, '0')}.`);
}

const processDataProcessing = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    const opcode = (i >>> 21) & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;

    const value1 = cpu.getGeneralRegister(rn);
    const [value2, shiftCarry] = getShiftOperandValue(cpu, i);
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
    return { incrementPC: true };
}

/**
 * Addressing Mode 1
 * This returns an array [value, carry].
 * Some instructions set the carry condition flag based on the shifting
 * in the shift operand, so it is returned along with the value.
 * 
 * Instructions are expected to be provided in the big-endian format.
 */
const getShiftOperandValue = (cpu: CPU, i: number) : number[] => {
    let value = 0;
    let carry = 0;
    let valueOffset = 0;
    const iFlag = (i >> 25) & 0x1;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');

    if (iFlag) {
        const rotate = (i >>> 8) & 0xF;
        const imm = i & 0xFF;
        value = rotateRight(imm, rotate * 2, 32);
        carry = rotate === 0 ?
            cFlag :
            (value >>> 31) & 0x1;
    } else if (((i >>> 4) & 0xFF) === 0) {
        // Single register operand without shift
        const rm = i & 0xF;
        value = cpu.getGeneralRegister(rm);
        if (rm === 15) {
            value += 8;
        }
        carry = cFlag;
    } else {
        const rm = i & 0xF;

        // If R15 is used for RM, value of register should be R15 + 8.
        if (rm == 15) {
            valueOffset = 8;
        }

        const shiftType = (i >>> 5) & 0x3;
        // 4th bit is 0 for immediate shifts, 1 for register shifts.
        const shiftOpcode = (i >>> 4) & 0x1;
        const immediateShift = shiftOpcode === 0;

        let shiftAmount = 0;
        if (immediateShift) {
            // Rm shifted by immediate value
            const imm = (i >>> 7) & 0x1F;
            shiftAmount = imm;
        } else {
            // Rm shifted by register value
            const rs = (i >>> 8) & 0xF;
            shiftAmount = cpu.getGeneralRegister(rs) & 0xFF;
        }

        switch (shiftType) {
            case 0x0:
                // Logical shift left
                if (shiftAmount === 0) {
                    value = cpu.getGeneralRegister(rm);
                    carry = cFlag;
                } else if (shiftAmount == 32) {
                    value = 0;
                    carry = cpu.getGeneralRegister(rm) & 0x1;
                } else {
                    [value, carry] = logicalShiftLeft(cpu.getGeneralRegister(rm), shiftAmount);
                }
                break;
            case 0x1:
                // Logical shift right
                if (immediateShift && shiftAmount === 0) {
                    value = 0;
                    carry = cpu.getGeneralRegister(rm) >>> 31;
                } else if (shiftAmount === 0) {
                    value = cpu.getGeneralRegister(rm);
                    carry = cFlag;
                } else {
                    [value, carry] = logicalShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
                }
                break;
            case 0x2:
                // Arithmetic shift right
                if (immediateShift) {
                    if (shiftAmount === 0) {
                        const rmSignBit = (cpu.getGeneralRegister(rm) >>> 31) & 0x1;
                        value = rmSignBit === 0 ? 0 : 0xFFFFFFFF;
                        carry = rmSignBit
                    } else {
                        [value, carry] = arithmeticShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
                    }
                } else {
                    // Shifting by register value
                    if (shiftAmount === 0) {
                        value = cpu.getGeneralRegister(rm);
                        carry = cFlag;
                    } else if (shiftAmount >= 32) {
                        const rmSignBit = (cpu.getGeneralRegister(rm) >>> 31) & 0x1;
                        value = rmSignBit === 0 ? 0 : 0xFFFFFFFF;
                        carry = rmSignBit
                    } else {
                        [value, carry] = arithmeticShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
                    }
                }
                break;
            case 0x3:
                // Rotate right
                if (immediateShift) {
                    if (shiftAmount === 0) {
                        const rmValue = cpu.getGeneralRegister(rm);
                        value = (cFlag << 31) | (rmValue >> 1);
                        carry = rmValue & 0x1;
                    } else {
                        value = rotateRight(cpu.getGeneralRegister(rm), shiftAmount, 32);
                    }
                } else {
                    if (shiftAmount === 0) {
                        // Bottom 8 bits are 0
                        value = cpu.getGeneralRegister(rm);
                        carry = cFlag;
                    } else if ((shiftAmount & 0x1F) === 0) {
                        // Bottom 5 bits are 0
                        value = cpu.getGeneralRegister(rm);
                        carry = (value >>> 31) & 0x1;
                    } else {
                        // Bottom 4 bits are >0
                        shiftAmount = shiftAmount & 0x1F;
                        const rmValue = cpu.getGeneralRegister(rm)
                        value = rotateRight(rmValue, shiftAmount, 32);
                        carry = (rmValue >>> (shiftAmount - 1)) & 0x1;
                    }
                }
                break;
            default:
                console.log(`InstructionProcessor.getShiftOperandValue: illegal shiftType ${shiftType.toString(2)} from instruction ${i.toString(16)}`);
        }
    }

    value += valueOffset;
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
    const condition = (i >>> 28) & 0xF;
    const conditionPassed = cpu.conditionIsMet(condition);
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
                address = ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0;
            } else if (p === 1 && w === 1) {
                // Immediate pre-indexed
                address = ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0;
                if (conditionPassed) cpu.setGeneralRegister(rn, address);
            } else if (p === 0 && w === 0) {
                // Immediate post-indexed
                address = rnValue;
                if (conditionPassed) cpu.setGeneralRegister(rn, ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0);
            }
        } else {
            const sign = u === 1 ? 1 : -1;
            const shiftImmediate = (i >>> 7) & 0x1F;
            const shiftType = (i >>> 5) & 0x3;
            const rm = i & 0xF;
            const rmValue = cpu.getGeneralRegister(rm);
            const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
            let index = 0;

            switch (shiftType) {
                case 0b00:
                    // LSL
                    [index] = logicalShiftLeft(rmValue, shiftImmediate);
                    break;
                case 0b01:
                    // LSR
                    if (shiftImmediate === 0) {
                        index = 0;
                    } else {
                        [index] = logicalShiftRight(rmValue, shiftImmediate);
                    }
                    break;
                case 0b10:
                    // ASR
                    if (shiftImmediate === 0) {
                        if (isNegative32(rmValue)) {
                            index = 0xFFFFFFFF;
                        } else {
                            index = 0;
                        }
                    } else {
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
                address = ((rnValue + sign * index) & 0xFFFFFFFF) >>> 0;
            } else if (p === 1 && w === 1) {
                // Register pre-indexed
                address = ((rnValue + sign * index) & 0xFFFFFFFF) >>> 0;
                if (conditionPassed) cpu.setGeneralRegister(rn, address);
            } else if (p === 0 && w === 0) {
                // Register post-indexed
                address = rnValue;
                if (conditionPassed) cpu.setGeneralRegister(rn, ((rnValue + sign * index) & 0xFFFFFFFF) >>> 0);
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
            address = ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0;
        } else if (p === 1 && w === 1) {
            // Pre-indexed
            address = ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0;
            if (conditionPassed) cpu.setGeneralRegister(rn, address);
        } else if (p === 0 && w === 0) {
            // Post-indexed
            address = rnValue;
            if (conditionPassed) cpu.setGeneralRegister(rn, ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0);
        }
    }

    return address >>> 0;
}

/**
 * Addressing Mode 4
 * Returns an array [startAddress, endAddress], marking the start and end
 * addresses to read/set a series of values in memory.
 */
const getLoadStoreMultipleAddress = (cpu: CPU, i: number) : number[] => {
    const condition = (i >>> 28) & 0xF;
    const conditionPassed = cpu.conditionIsMet(condition);
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
            if (conditionPassed && w === 1) {
                rnValue -= (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
        case 0b01:
            // Increment After
            startAddress = rnValue;
            endAddress = rnValue + (bitsSet * 4) - 4
            if (conditionPassed && w === 1) {
                rnValue += (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
        case 0b10:
            // Decrement Before
            startAddress = rnValue - (bitsSet * 4);
            endAddress = rnValue - 4;
            if (conditionPassed && w === 1) {
                rnValue -= (bitsSet * 4);
                cpu.setGeneralRegister(rn, rnValue);
            }
            break;
        case 0b11:
            // Increment Before
            startAddress = rnValue + 4;
            endAddress = rnValue + (bitsSet * 4);
            if (conditionPassed && w === 1) {
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
    const value132 = value1 & 0xFFFFFFFF;
    const value232 = value2 & 0xFFFFFFFF;
    const result32 = value132 & value232;
    cpu.history.setInstructionName('AND');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
            if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
            if (shiftCarry === 1) cpu.setStatusRegisterFlag('c', 1);
        }
    }
    return result32;
}

const processEor = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    cpu.history.setInstructionName('EOR');
    cpu.setGeneralRegister(rd, value1 ^ value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setStatusRegisterFlag('z', 1);
            if (result < 0) cpu.setStatusRegisterFlag('n', 1);
            if (shiftCarry === 1) cpu.setStatusRegisterFlag('c', 1);
        }
    }
    return result;
}

const processSub = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    cpu.history.setInstructionName('SUB');
    const result = value1 - value2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
        if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
        if (borrowFrom(value1, value2) === 0) cpu.setStatusRegisterFlag('c', 1);
        if (signedOverflowFromSubtraction(value1, value2, result32) === 1) cpu.setStatusRegisterFlag('v', 1);
    }
    return result;
}

const processRsb = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const result = value2 - value1;
    const result32 = result & 0xFFFFFFFF;
    cpu.history.setInstructionName('RSB');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
        if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
        // Unsigned overflow
        if (borrowFrom(value2, value1) === 0) cpu.setStatusRegisterFlag('c', 1);
        // Signed overflow
        if (signedOverflowFromSubtraction(value2, value1, result32)) cpu.setStatusRegisterFlag('v', 1);
    }
    return result;
}

const processAdd = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const result32 = (value1 + value2) & 0xFFFFFFFF;
    const result = value1 + value2;
    cpu.history.setInstructionName('ADD');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
        if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
        // Unsigned overflow
        if (result > 2**32 - 1) cpu.setStatusRegisterFlag('c', 1);
        // Signed overflow
        const resultMSB = (result >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setStatusRegisterFlag('v', 1);
        }
    }
    return result;
}

const processAdc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
    cpu.history.setInstructionName('ADC');
    const result = value1 + value2 + cFlag;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
        if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
        // Unsigned overflow
        if (result > 2**32 - 1) cpu.setStatusRegisterFlag('c', 1);
        // Signed overflow
        const resultMSB = (result32 >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setStatusRegisterFlag('v', 1);
        }
    }
    return result;
}

const processSbc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
    const notCarry = cFlag === 1 ? 0 : 1;
    const result = value1 - value2 - notCarry;
    const result32 = result & 0xFFFFFFFF;
    cpu.history.setInstructionName('SBC');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
        if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
        // Unsigned overflow
        if (borrowFrom(value1, value2 + notCarry) === 0) cpu.setStatusRegisterFlag('c', 1);
        // Signed overflow
        if (signedOverflowFromSubtraction(value1, value2 + notCarry, result32)) cpu.setStatusRegisterFlag('v', 1);
    }
    return result;
}

const processRsc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
    const notCarry = cFlag === 1 ? 0 : 1;
    const result = value2 - value1 - notCarry;
    const result32 = result & 0xFFFFFFFF;
    cpu.history.setInstructionName('RSC');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
        if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
        // Unsigned overflow
        // TODO: what if the `value1 + 1` overflows, does this check still work?
        if (borrowFrom(value2, value1 + notCarry) === 0) cpu.setStatusRegisterFlag('c', 1);
        // Signed overflow
        if (signedOverflowFromSubtraction(value2, value1 + notCarry, result32) === 1) cpu.setStatusRegisterFlag('v', 1);
    }
    return result;
}

const processTst = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag, shiftCarry} = data;
    cpu.history.setInstructionName('TST');
    const aluOut = (value1 & value2) & 0xFFFFFFFF;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (isNegative32(aluOut)) cpu.setStatusRegisterFlag('n', 1);
        if (aluOut === 0) cpu.setStatusRegisterFlag('z', 1);
        if (shiftCarry) cpu.setStatusRegisterFlag('c', 1);
    }
    return 0;
}

const processTeq = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag, shiftCarry} = data;
    cpu.history.setInstructionName('TEQ');
    const aluOut = (value1 ^ value2) & 0xFFFFFFFF;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (isNegative32(aluOut)) cpu.setStatusRegisterFlag('n', 1);
        if (aluOut === 0) cpu.setStatusRegisterFlag('z', 1);
        if (shiftCarry) cpu.setStatusRegisterFlag('c', 1);
    }
    return 0;
}

const processCmp = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag} = data;
    cpu.history.setInstructionName('CMP');
    const aluOut = value1 - value2;
    const aluOut32 = aluOut & 0xFFFFFFFF;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (isNegative32(aluOut32)) cpu.setStatusRegisterFlag('n', 1);
        if (aluOut32 === 0) cpu.setStatusRegisterFlag('z', 1);
        // Set C flag if there was no borrow
        if (borrowFrom(value1, value2) === 0) cpu.setStatusRegisterFlag('c', 1);
        // Signed Overflow
        if (signedOverflowFromSubtraction(value1, value2, aluOut32)) cpu.setStatusRegisterFlag('v', 1);
    }
    return 0;
}

const processCmn = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag} = data;
    cpu.history.setInstructionName('CMN');
    const aluOut = value1 + value2;
    const aluOut32 = aluOut & 0xFFFFFFFF;
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (isNegative32(aluOut32)) cpu.setStatusRegisterFlag('n', 1);
        if (aluOut32 === 0) cpu.setStatusRegisterFlag('z', 1);
        // Unsigned overflow
        if (aluOut > 2**32 - 1) cpu.setStatusRegisterFlag('c', 1);
        // Signed Overflow
        const resultMSB = (aluOut >>> 31) & 0x1;
        const value1MSB = (value1 >>> 31) & 0x1;
        const value2MSB = (value2 >>> 31) & 0x1;
        if (value1MSB === value2MSB && value1MSB !== resultMSB) {
            cpu.setStatusRegisterFlag('v', 1);
        }
    }
    return 0;
}

const processOrr = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    const result32 = (value1 | value2) & 0xFFFFFFFF;
    cpu.history.setInstructionName('ORR');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
            if (isNegative32(result32)) cpu.setStatusRegisterFlag('n', 1);
            if (shiftCarry === 1) cpu.setStatusRegisterFlag('c', 1);
        }
    }
    return result32;
}

const processMov = (data: DataProcessingParameter) : number => {
    const {cpu, value2, rd, sFlag, shiftCarry} = data;
    const result32 = value2 & 0xFFFFFFFF;
    cpu.history.setInstructionName('MOV');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
            if (result32 < 0) cpu.setStatusRegisterFlag('n', 1);
            if (shiftCarry === 1) cpu.setStatusRegisterFlag('c', 1);
        }
    }
    return result32;
}

const processBic = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    const result = (value1 & (~value2)) & 0xFFFFFFFF;
    cpu.history.setInstructionName('BIC');
    cpu.setGeneralRegister(rd, result);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result === 0) cpu.setStatusRegisterFlag('z', 1);
            if (isNegative32(result)) cpu.setStatusRegisterFlag('n', 1);
            if (shiftCarry === 1) cpu.setStatusRegisterFlag('c', 1);
        }
    }
    return result;
}

const processMvn = (data: DataProcessingParameter) : number => {
    const {cpu, value2, rd, sFlag, shiftCarry} = data;
    const result32 = ~value2 & 0xFFFFFFFF;
    cpu.history.setInstructionName('MVN');
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.clearConditionCodeFlags();
            if (result32 === 0) cpu.setStatusRegisterFlag('z', 1);
            if (result32 < 0) cpu.setStatusRegisterFlag('n', 1);
            if (shiftCarry === 1) cpu.setStatusRegisterFlag('c', 1);
        }
    }
    return result32;
}

// Branch Instructions

const processBBL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    const lFlag = (i >>> 24) & 0x1;
    cpu.history.setInstructionName(lFlag ? "BL" : "B");

    const instructionSize = 4;
    const imm = signExtend(i & 0xFFFFFF, 24);
    const pc = cpu.getGeneralRegister(Reg.PC);
    const newPC = pc + (imm << 2) + (instructionSize * 2);
    cpu.setGeneralRegister(Reg.PC, newPC);
    if (lFlag === 1) {
        cpu.setGeneralRegister(Reg.LR, pc + instructionSize);
    }
    return { incrementPC: false };
}

const processBLX = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`BLX (${type})`);
    cpu.history.addError(`Unsupported BLX instruction: 0x${(i >>> 0).toString(16)}. This instruction is only available on ARMv5 and above.`);
    return { incrementPC: false };

}

const processBX = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('BX');
    const rm = i & 0xF;
    const rmValue = cpu.getGeneralRegister(rm);
    const instructionSize = 4;
    const pc = (rmValue + instructionSize * 2) & 0xFFFFFFFE;
    cpu.setStatusRegisterFlag('t', rmValue & 0x1);
    cpu.setGeneralRegister(Reg.PC, pc);
    return { incrementPC: false };
}

// Load & Store Instructions

const processLDR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDR');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = cpu.getBytesFromMemory(wordAlignAddress(address), 4);
    let value = byteArrayToInt32(bytes, cpu.bigEndian);
    switch (address & 0x3) {
        case 0b01: value = rotateRight(value, 8, 32); break;
        case 0b10: value = rotateRight(value, 16, 32); break;
        case 0b11: value = rotateRight(value, 24, 32); break;
    }

    if (rd === 15) {
        const newPC = value & 0xFFFFFFFC;
        cpu.setGeneralRegister(Reg.PC, newPC);
    } else {
        cpu.setGeneralRegister(rd, value);
    }
    return { incrementPC: true };
}

const processLDRB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRB');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = cpu.getBytesFromMemory(address, 1)[0];
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRBT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRBT');
    const rd = (i >>> 12) & 0xF;
    
    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    const address = getLoadStoreAddress(cpu, i & 0xFFDFFFFF);
    const value = cpu.getBytesFromMemory(address, 1)[0];
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRH');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = cpu.getBytesFromMemory(halfWordAlignAddress(address), 2);
    const value = byteArrayToInt32(bytes, cpu.bigEndian);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRSB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRSB');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = signExtend(cpu.getBytesFromMemory(address, 1)[0], 8);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRSH');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    let value = byteArrayToInt32(cpu.getBytesFromMemory(halfWordAlignAddress(address), 2), cpu.bigEndian);
    value = signExtend(value, 16);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDRT');
    const rd = (i >>> 12) & 0xF;

    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    const address = getLoadStoreAddress(cpu, i & 0xFFDFFFFF);
    const bytes = cpu.getBytesFromMemory(wordAlignAddress(address), 4);
    let value = byteArrayToInt32(bytes, cpu.bigEndian);
    switch (address & 0x3) {
        case 0b01: value = rotateRight(value, 8, 32); break;
        case 0b10: value = rotateRight(value, 16, 32); break;
        case 0b11: value = rotateRight(value, 24, 32); break;
    }
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processSTR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STR');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(wordAlignAddress(address), bytes);
    return { incrementPC: true };
}

const processSTRB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STRB');
    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([cpu.getGeneralRegister(rd) & 0xFF]);
    cpu.setBytesInMemory(address, bytes);
    return { incrementPC: true };
}

const processSTRBT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STRBT');
    const rd = (i >>> 12) & 0xF;

    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    const address = getLoadStoreAddress(cpu, i & 0xFFDFFFFF);
    const bytes = new Uint8Array([cpu.getGeneralRegister(rd) & 0xFF]);
    cpu.setBytesInMemory(address, bytes);
    return { incrementPC: true };
}

const processSTRH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STRH');
    const rd = (i >>> 12) & 0xF;
    const rdValue = cpu.getGeneralRegister(rd);
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([rdValue & 0xFF, (rdValue >> 8) & 0xFF]);
    if (cpu.bigEndian) bytes.reverse();
    cpu.setBytesInMemory(address, bytes);
    return { incrementPC: true };
}

const processSTRT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STRT');
    const rd = (i >>> 12) & 0xF;

    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    const address = getLoadStoreAddress(cpu, i & 0xFFDFFFFF);
    const bytes = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(wordAlignAddress(address), bytes);
    return { incrementPC: true };
}

// Load & Store Multiple Instructions

const processLDM = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`LDM (${type})`);
    const [startAddress, endAddress] = getLoadStoreMultipleAddress(cpu, i);
    const regList = (i & 0xFFFF);
    let address = wordAlignAddress(startAddress);

    switch (type) {
        case 1:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    const riValue = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                    cpu.setGeneralRegister(i, riValue);
                    address += 4;
                }
            }
            if (((regList >>> 15) & 0x1) === 1) {
                const value = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                const newPC = value & 0xFFFFFFFC;
                cpu.setGeneralRegister(Reg.PC, newPC);
                address += 4;
            }
            break;
        case 2:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    const riValue = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                    cpu.setGeneralRegisterByMode(i, riValue, 'usr');
                    address += 4;
                }
            }
            break;
        case 3:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    const riValue = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
                    cpu.setGeneralRegisterByMode(i, riValue, 'usr');
                    address += 4;
                }
            }
            cpu.spsrToCPSR();
            const value = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
            const t = cpu.getStatusRegisterFlag('CPSR', 't');
            const newPC = t === 1 ?
                value & 0xFFFFFFFE :
                value & 0xFFFFFFFC;
            cpu.setGeneralRegister(Reg.PC, newPC);
            address += 4;
            break;
    }

    if (address - 4 !== endAddress) {
        throw Error(`LDM (${type}) failure: address ${address - 4} does not match expected end address ${endAddress}`);
    }

    // TODO: LDM can modify PC, in which case increment PC should be false
    return { incrementPC: true };
}

const processSTM = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`STM (${type})`);
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
        throw Error(`STM (${type}) failure: address ${address - 4} does not match expected end address ${endAddress}`);
    }
    return { incrementPC: true };
}

// Multiply Instructions

const processMUL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MUL');
    const rd = (i >>> 16) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const result = (cpu.getGeneralRegister(rm) * cpu.getGeneralRegister(rs)) & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);
    if (sFlag) {
        const prevCFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
        const prevVFlag = cpu.getStatusRegisterFlag('CPSR', 'v');
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setStatusRegisterFlag('z', 1);
        if (result < 0) cpu.setStatusRegisterFlag('n', 1);
        if (prevCFlag) cpu.setStatusRegisterFlag('c', 1);
        if (prevVFlag) cpu.setStatusRegisterFlag('v', 1);
    }
    return { incrementPC: true };
}

const processMLA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MLA');
    const rd = (i >>> 16) & 0xF;
    const rn = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const result = (cpu.getGeneralRegister(rm) * cpu.getGeneralRegister(rs) + cpu.getGeneralRegister(rn)) & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);
    if (sFlag) {
        const prevCFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
        const prevVFlag = cpu.getStatusRegisterFlag('CPSR', 'v');
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setStatusRegisterFlag('z', 1);
        if (result < 0) cpu.setStatusRegisterFlag('n', 1);
        if (prevCFlag) cpu.setStatusRegisterFlag('c', 1);
        if (prevVFlag) cpu.setStatusRegisterFlag('v', 1);
    }
    return { incrementPC: true };
}

const processSMULL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SMULL');
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;

    let rmValue = cpu.getGeneralRegister(rm);
    let rsValue = cpu.getGeneralRegister(rs);
    const rmNegative = isNegative32(rmValue);
    const rsNegative = isNegative32(rsValue);

    if (rmNegative) rmValue = value32ToNative(rmValue);
    if (rsNegative) rsValue = value32ToNative(rsValue);

    const result = rmValue * rsValue;
    const rdHiValue = Math.floor(result / 0x100000000) & 0xFFFFFFFF;
    const rdLoValue = result & 0xFFFFFFFF;

    cpu.setGeneralRegister(rdHi, rdHiValue);
    cpu.setGeneralRegister(rdLo, rdLoValue);

    if (sFlag) {
        cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue) ? 1 : 0);
    }
    return { incrementPC: true };
}

const processUMULL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('UMULL');
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;

    const rmValue = cpu.getGeneralRegister(rm);
    const rsValue = cpu.getGeneralRegister(rs);
    const result = rmValue * rsValue;

    const rdHiValue = Math.floor(result / 0x100000000) & 0xFFFFFFFF;
    const rdLoValue = result & 0xFFFFFFFF;
    
    cpu.setGeneralRegister(rdHi, rdHiValue);
    cpu.setGeneralRegister(rdLo, rdLoValue);

    if (sFlag) {
        cpu.setStatusRegisterFlag('z', result === 0 ? 1 : 0);
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue) ? 1 : 0);
    }
    return { incrementPC: true };
}

const processSMLAL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SMLAL');
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;

    let rmValue = cpu.getGeneralRegister(rm);
    let rsValue = cpu.getGeneralRegister(rs);
    let rdLoValue = cpu.getGeneralRegister(rdLo);
    let rdHiValue = cpu.getGeneralRegister(rdHi);
    const rmNegative = isNegative32(rmValue);
    const rsNegative = isNegative32(rsValue);

    if (rmNegative) rmValue = value32ToNative(rmValue);
    if (rsNegative) rsValue = value32ToNative(rsValue);

    const result = rmValue * rsValue;
    rdLoValue = ((result & 0xFFFFFFFF) >>> 0) + rdLoValue
    const rdLoCarry = (rdLoValue > 2**32 - 1) ? 1 : 0;
    rdHiValue = (Math.floor(result / 0x100000000) & 0xFFFFFFFF) + rdHiValue + rdLoCarry;

    rdLoValue = rdLoValue & 0xFFFFFFFF;
    rdHiValue = rdHiValue & 0xFFFFFFFF;

    cpu.setGeneralRegister(rdHi, rdHiValue);
    cpu.setGeneralRegister(rdLo, rdLoValue);

    if (sFlag) {
        cpu.setStatusRegisterFlag('z', (rdLoValue === 0 && rdHiValue === 0) ? 1 : 0);
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue) ? 1 : 0);
    }
    return { incrementPC: true };
}

const processUMLAL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('UMLAL');
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;

    const rmValue = cpu.getGeneralRegister(rm);
    const rsValue = cpu.getGeneralRegister(rs);
    let rdLoValue = cpu.getGeneralRegister(rdLo);
    let rdHiValue = cpu.getGeneralRegister(rdHi);

    const result = rmValue * rsValue;
    rdLoValue = ((result & 0xFFFFFFFF) >>> 0) + rdLoValue
    const rdLoCarry = (rdLoValue > 2**32 - 1) ? 1 : 0;
    rdHiValue = (Math.floor(result / 0x100000000) & 0xFFFFFFFF) + rdHiValue + rdLoCarry;

    rdLoValue = rdLoValue & 0xFFFFFFFF;
    rdHiValue = rdHiValue & 0xFFFFFFFF;

    cpu.setGeneralRegister(rdHi, rdHiValue);
    cpu.setGeneralRegister(rdLo, rdLoValue);

    if (sFlag) {
        cpu.setStatusRegisterFlag('z', (rdLoValue === 0 && rdHiValue === 0) ? 1 : 0);
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue) ? 1 : 0);
    }
    return { incrementPC: true };
}

// Miscellaneous Arithmetic Instructions

 const processCLZ = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('CLZ');
    cpu.history.addError(`CLZ instruction (0x${i.toString(16)}) is only supported in architecture version 5 and above.`);
    return { incrementPC: true };
 }

 // Status Register Instructions

const processMRS = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MRS');

    const rFlag = (i >>> 22) & 0x1;
    const rd = (i >> 12) & 0xF;

    if (rFlag === 1) {
        const spsr = cpu.getStatusRegister('SPSR');
        cpu.setGeneralRegister(rd, spsr);
    } else {
        const cpsr = cpu.getStatusRegister('CPSR');
        cpu.setGeneralRegister(rd, cpsr);
    }

    return { incrementPC: true };
}

const processMSR = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName(`MSR`);

    // type = 1 => immediate operand, 2 => register operand
    let operand;
    if (type === 1) {
        const rotation = ((i >>> 8) & 0xF) * 2;
        const imm = i & 0xFF;
        operand = rotateRight(imm, rotation, 32);
    } else {
        const rm = i & 0xF;
        operand = cpu.getGeneralRegister(rm);
    }

    const rFlag = (i >>> 22) & 0x1;
    const fieldMask = (i >>> 16) & 0xF;

    if (rFlag === 0) {
        const privilegedMode = cpu.inAPrivilegedMode();
        let cpsr = cpu.getStatusRegister('CPSR');
        if ((fieldMask & 0x1) > 0 && privilegedMode) {
            // cpsr 7:0 = operand 7:0
            cpsr &= 0xFFFFFF00;
            cpsr |= (operand & 0xFF);
        }

        // The status and field extensions (bits 8:23) are unused in version 4.
        /*
        if ((fieldMask & 0b10) > 0 && privilegedMode) {
            // cpsr 15:8 = operand 15:8
            cpsr &= 0xFFFF00FF;
            cpsr |= (operand & 0xFF00);
        }
        if ((fieldMask & 0b100) > 0 && privilegedMode) {
            // cpsr 23:16 = operand 23:16
            cpsr &= 0xFF00FFFF;
            cpsr |= (operand & 0xFF0000);
        }
        */

        if ((fieldMask & 0b1000) > 0) {
            // cpsr 31:24 = operand 31:24
            cpsr &= 0x00FFFFFF;
            cpsr |= (operand & 0xFF000000);
        }
        cpu.setStatusRegister('CPSR', cpsr);
    } else if (cpu.currentModeHasSPSR()) {
        let spsr = cpu.getStatusRegister('SPSR');
        if ((fieldMask & 0x1) > 0) {
            // spsr 7:0 = operand 7:0
            spsr &= 0xFFFFFF00;
            spsr |= (operand & 0xFF);
        }

        // The status and field extensions (bits 8:23) are unused in version 4.
        /*
        if ((fieldMask & 0b10) > 0) {
            // spsr 15:8 = operand 15:8
            spsr &= 0xFFFF00FF;
            spsr |= (operand & 0xFF00);
        }
        if ((fieldMask & 0b100) > 0) {
            // spsr 23:16 = operand 23:16
            spsr &= 0xFF00FFFF;
            spsr |= (operand & 0xFF0000);
        }
        */

        if ((fieldMask & 0b1000) > 0) {
            // spsr 31:24 = operand 31:24
            spsr &= 0x00FFFFFF;
            spsr |= (operand & 0xFF000000);
        }
        cpu.setStatusRegister('SPSR', spsr);
    }

    return { incrementPC: true };
}

// Semaphore Instructions

const processSWP = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SWP');

    const rn = (i >>> 16) & 0xF;
    const rnValue = cpu.getGeneralRegister(rn);
    const rd = (i >>> 12) & 0xF;
    const rm = i & 0xF;
    const rmValue = cpu.getGeneralRegister(rm);

    const address = wordAlignAddress(rnValue);

    let temp = 0;
    if ((rnValue & 0x3) === 0x0) {
        temp = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
    } else if ((rnValue & 0x3) === 0x1) {
        temp = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
        temp = rotateRight(temp, 8, 32);
    } else if ((rnValue & 0x3) === 0x2) {
        temp = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
        temp = rotateRight(temp, 16, 32);
    } else if ((rnValue & 0x3) === 0x3) {
        temp = byteArrayToInt32(cpu.getBytesFromMemory(address, 4), cpu.bigEndian);
        temp = rotateRight(temp, 24, 32);
    }

    cpu.setBytesInMemory(address, int32ToByteArray(rmValue, cpu.bigEndian));
    cpu.setGeneralRegister(rd, temp);

    return { incrementPC: true };
}

const processSWPB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('SWPB');

    const rn = (i >>> 16) & 0xF;
    const rnValue = cpu.getGeneralRegister(rn);
    const rd = (i >>> 12) & 0xF;
    const rm = i & 0xF;
    const rmValue = cpu.getGeneralRegister(rm);

    // Address is not word aligned when accessing a single byte.
    const address = rnValue;

    const temp = byteArrayToInt32(cpu.getBytesFromMemory(address, 1), cpu.bigEndian);
    cpu.setBytesInMemory(address, int8ToByteArray(rmValue & 0xF, cpu.bigEndian));
    cpu.setGeneralRegister(rd, temp);

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
    cpu.history.addError(`SWI not implemented: 0x${i.toString(16).padStart(8, '0')}.`);
    return { incrementPC: true };
}

// Co-Processor Instructions

const processCDP = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('CDP');
    cpu.history.addError(`Coprocessor instructions not supported: 0x${i.toString(16).padStart(8, '0')} (CDP).`);
    return { incrementPC: true };
}

const processLDC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('LDC');
    cpu.history.addError(`Coprocessor instructions not supported: 0x${i.toString(16).padStart(8, '0')} (LDC).`);
    return { incrementPC: true };
}

const processMCR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MCR');
    cpu.history.addError(`Coprocessor instructions not supported: 0x${i.toString(16).padStart(8, '0')} (MCR).`);
    return { incrementPC: true };
}

const processMRC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('MRC');
    cpu.history.addError(`Coprocessor instructions not supported: 0x${i.toString(16).padStart(8, '0')} (MRC).`);
    return { incrementPC: true };
}

const processSTC = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    cpu.history.setInstructionName('STC');
    cpu.history.addError(`Coprocessor instructions not supported: 0x${i.toString(16).padStart(8, '0')} (STC).`);
    return { incrementPC: true };
}

export { processARM, getShiftOperandValue, getLoadStoreAddress, getLoadStoreMultipleAddress }
export type { ProcessedInstructionOptions }
