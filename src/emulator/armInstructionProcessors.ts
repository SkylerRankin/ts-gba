import { CPU, OperatingModes, Reg } from './cpu';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight, signExtend, int32ToByteArray, numberOfSetBits, isNegative32, borrowFrom, signedOverflowFromSubtraction, value32ToNative, wordAlignAddress, int8ToByteArray, halfWordAlignAddress, signedOverflowFromAddition } from './math';

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
    // Branch instructions
    if (((i >>> 4) & 0xFFFFFF) === 0x12FFF1) return processBX(cpu, i);
    if (((i >>> 25) & 0x7F) === 0x7D) return processBLX(cpu, i, 1);
    if (((i >>> 4) & 0xFFFFFF) === 0x12FFF3) return processBLX(cpu, i, 2);
    // Check for B/BL after BLX(1) due to overlap in bits 27:25
    if (((i >>> 25) & 0x7) === 0x5) return processBBL(cpu, i);

    const b15 = (i >> 15) & 0x1;
    const b20 = (i >> 20) & 0x1;
    const b21 = (i >> 21) & 0x1;
    const b22 = (i >> 22) & 0x1;
    const b24 = (i >> 24) & 0x1;

    // Load/store instructions
    if (((i >>> 26) & 0x3) === 0x1) {
        if (b24 === 0 && ((i >>> 20) & 0x7) === 0x7) return processLDRBT(cpu, i);
        if (b24 === 0 && ((i >>> 20) & 0x7) === 0x3) return processLDRT(cpu, i);
        if (b22 === 0 && b20 === 1) return processLDR(cpu, i);
        if (b22 === 1 && b20 === 1) return processLDRB(cpu, i);
        if (b24 === 0 && ((i >>> 20) & 0x7) === 0b110) return processSTRBT(cpu, i);
        if (b24 === 0 && ((i >>> 20) & 0x7) === 0b010) return processSTRT(cpu, i);
        if (b22 === 0 && b20 === 0) return processSTR(cpu, i);
        if (b22 === 1 && b20 === 0) return processSTRB(cpu, i);
    } else if (((i >>> 25) & 0x7) === 0x0 && b20 === 1) {
        if (((i >>> 4) & 0xF) === 0xB) return processLDRH(cpu, i);
        if (((i >>> 4) & 0xF) === 0xD) return processLDRSB(cpu, i);
        if (((i >>> 4) & 0xF) === 0xF) return processLDRSH(cpu, i);
    } else if (((i >>> 25) & 0x7) === 0x4) {
        if (b22 === 0 && b20 === 1) return processLDM(cpu, i, 1);
        if (((i >>> 20) & 0x7) === 0x5 && b15 === 0) return processLDM(cpu, i, 2);
        /**
         * The specification states that bit 15 should be 1 for LDM (3), since PC is
         * always included in the register load list. In practice, some ROMs seem to
         * not have this bit set and thus do not load into PC.
         */
        if (b22 === 1 && b20 === 1 /*&& b15 === 1*/) return processLDM(cpu, i, 3);
    }

    // Coprocessor Load & Store
    if (((i >>> 25) & 0x7) === 0b110) {
        if (b20 === 1) return processLDC(cpu, i);
        if (b20 === 0) return processSTC(cpu, i);
    }

    // Coprocessor Data Processing and Register Transfers
    if (((i >>> 24) & 0xF) === 0b1110) {
        if (((i >> 4) & 0x1) === 0) return processCDP(cpu, i);
        else if (b20 === 0) return processMCR(cpu, i);
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
        if (b20 === 0 && ((i >>> 4) & 0xF) === 0b1011) return processSTRH(cpu, i);

        // Multiply Instructions
        if (((i >>> 21) & 0x7F) === 0x1 && ((i >>> 4) & 0xF) === 0b1001) return processMLA(cpu, i);
        if (((i >>> 21) & 0x7F) === 0x0 && ((i >>> 12) & 0xF) === 0x0 && ((i >>> 4) & 0xF) === 0b1001) return processMUL(cpu, i);
        if (((i >>> 23) & 0x1F) === 0x1 && ((i >>> 4) & 0xF) === 0b1001) {
            if (b22 === 0) {
                if (b21 === 0) {
                    return processUMULL(cpu, i);
                } else {
                    return processUMLAL(cpu, i);
                }
            } else {
                if (b21 === 0) {
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
    if (((i >>> 25) & 0x7) === 0x4 && b22 === 0 && b20 === 0) return processSTM(cpu, i, 1);
    if (((i >>> 25) & 0x7) === 0x4 && b22 === 1 && b20 === 0) return processSTM(cpu, i, 2);

    // CLZ
    if (((i >>> 16) & 0xFFF) === 0b000101101111 && ((i >>> 4) & 0xFF) === 0b11110001) return processCLZ(cpu, i);

    // Data processing instructions
    if ((i & 0x0C000000) === 0) return processDataProcessing(cpu, i);

    throw Error(`Failed to decode instruction: 0x${(i >>> 0).toString(16).padStart(8, '0')}.`);
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

    if (rd === Reg.PC) {
        // Add PC offset if the instruction edited PC. unless the value comes from LR?
        const adjustedPC = cpu.getGeneralRegister(Reg.PC) + 8;
        cpu.setGeneralRegister(Reg.PC, adjustedPC);
        return { incrementPC: false };
    } else {
        return { incrementPC: true };
    }
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
    const condition = (i >>> 28) & 0xF;
    const conditionPassed = cpu.conditionIsMet(condition);
    const mode = ((i >>> 26) & 0x3) === 0x1 ? 2 : 3;
    const p = (i >> 24) & 0x1;
    const u = (i >> 23) & 0x1;
    const b = (i >> 22) & 0x1;
    const w = (i >> 21) & 0x1;
    const l = (i >> 20) & 0x1;
    const rn = (i >>> 16) & 0xF;
    const rnValue = cpu.getGeneralRegister(rn);
    let address = 0;

    if (mode === 2) {
        const immediate = ((i >> 25) & 0x1) === 0;
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
        const immediate = ((i >> 22) & 0x1) === 1;
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

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('AND');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', shiftCarry === 1);
        }
    }
    return result32;
}

const processEor = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('EOR');
    // #REMOVE_IN_BUILD_END

    const result = value1 ^ value2;
    cpu.setGeneralRegister(rd, value1 ^ value2);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result));
            cpu.setStatusRegisterFlag('z', result === 0);
            cpu.setStatusRegisterFlag('c', shiftCarry === 1);
        }
    }
    return result;
}

const processSub = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SUB');
    // #REMOVE_IN_BUILD_END

    const result = value1 - value2;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', borrowFrom(value1, value2) === 0);
            cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(value1, value2, result32) === 1);
        }
    }
    return result;
}

const processRsb = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const result = value2 - value1;
    const result32 = result & 0xFFFFFFFF;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('RSB');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', borrowFrom(value2, value1) === 0);
            cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(value2, value1, result32));
        }
    }
    return result;
}

const processAdd = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const result32 = (value1 + value2) & 0xFFFFFFFF;
    const result = value1 + value2;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('ADD');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', result > 2**32 - 1);
            cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(value1, value2, result32));
        }
    }
    return result;
}

const processAdc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('ADC');
    // #REMOVE_IN_BUILD_END

    const result = value1 + value2 + cFlag;
    const result32 = result & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', result > 2**32 - 1);
            cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(value1, value2 + cFlag, result32));
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

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SBC');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', borrowFrom(value1, value2 + notCarry) === 0);
            cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(value1, value2 + notCarry, result32));
        }
    }
    return result;
}

const processRsc = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag} = data;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');
    const notCarry = cFlag === 1 ? 0 : 1;
    const result = value2 - value1 - notCarry;
    const result32 = result & 0xFFFFFFFF;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('RSC');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', borrowFrom(value2, value1 + notCarry) === 0);
            cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(value2, value1 + notCarry, result32));
        }
    }
    return result;
}

const processTst = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag, shiftCarry} = data;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('TST');
    // #REMOVE_IN_BUILD_END

    const aluOut = (value1 & value2) & 0xFFFFFFFF;
    if (sFlag) {
        cpu.setStatusRegisterFlag('n', isNegative32(aluOut));
        cpu.setStatusRegisterFlag('z', aluOut === 0);
        cpu.setStatusRegisterFlag('c', shiftCarry);
    }
    return 0;
}

const processTeq = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag, shiftCarry} = data;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('TEQ');
    // #REMOVE_IN_BUILD_END

    const aluOut = (value1 ^ value2) & 0xFFFFFFFF;
    if (sFlag) {
        cpu.setStatusRegisterFlag('n', isNegative32(aluOut));
        cpu.setStatusRegisterFlag('z', aluOut === 0);
        cpu.setStatusRegisterFlag('c', shiftCarry);
    }
    return 0;
}

const processCmp = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag} = data;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('CMP');
    // #REMOVE_IN_BUILD_END

    const aluOut = value1 - value2;
    const aluOut32 = aluOut & 0xFFFFFFFF;
    if (sFlag) {
        cpu.setStatusRegisterFlag('n', isNegative32(aluOut32));
        cpu.setStatusRegisterFlag('z', aluOut32 === 0);
        cpu.setStatusRegisterFlag('c', borrowFrom(value1, value2) === 0);
        cpu.setStatusRegisterFlag('v', signedOverflowFromSubtraction(value1, value2, aluOut32));
    }
    return 0;
}

const processCmn = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, sFlag} = data;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('CMN');
    // #REMOVE_IN_BUILD_END

    const aluOut = value1 + value2;
    const aluOut32 = aluOut & 0xFFFFFFFF;
    if (sFlag) {
        cpu.setStatusRegisterFlag('n', isNegative32(aluOut32));
        cpu.setStatusRegisterFlag('z', aluOut32 === 0);
        cpu.setStatusRegisterFlag('c', aluOut > 2**32 - 1);
        cpu.setStatusRegisterFlag('v', signedOverflowFromAddition(value1, value2, aluOut32));
    }
    return 0;
}

const processOrr = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    const result32 = (value1 | value2) & 0xFFFFFFFF;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('ORR');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', shiftCarry);
        }
    }
    return result32;
}

const processMov = (data: DataProcessingParameter) : number => {
    const {cpu, value2, rd, sFlag, shiftCarry} = data;
    const result32 = value2 & 0xFFFFFFFF;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MOV');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', shiftCarry);
        }
    }
    return result32;
}

const processBic = (data: DataProcessingParameter) : number => {
    const {cpu, value1, value2, rd, sFlag, shiftCarry} = data;
    const result = (value1 & (~value2)) & 0xFFFFFFFF;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('BIC');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result));
            cpu.setStatusRegisterFlag('z', result === 0);
            cpu.setStatusRegisterFlag('c', shiftCarry);
        }
    }
    return result;
}

const processMvn = (data: DataProcessingParameter) : number => {
    const {cpu, value2, rd, sFlag, shiftCarry} = data;
    const result32 = ~value2 & 0xFFFFFFFF;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MVN');
    // #REMOVE_IN_BUILD_END

    cpu.setGeneralRegister(rd, result32);
    if (sFlag) {
        if (rd === 15) {
            cpu.spsrToCPSR();
        } else {
            cpu.setStatusRegisterFlag('n', isNegative32(result32));
            cpu.setStatusRegisterFlag('z', result32 === 0);
            cpu.setStatusRegisterFlag('c', shiftCarry);
        }
    }
    return result32;
}

// Branch Instructions

const processBBL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    const lFlag = (i >>> 24) & 0x1;

    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(lFlag ? "BL" : "B");
    // #REMOVE_IN_BUILD_END

    const instructionSize = 4;
    const imm = signExtend(i & 0xFFFFFF, 24);
    const pc = cpu.getGeneralRegister(Reg.PC);
    const newPC = pc + (imm << 2) + (instructionSize * 2);
    cpu.setGeneralRegister(Reg.PC, newPC);
    if (lFlag === 1) {
        cpu.setGeneralRegister(Reg.LR, pc - (instructionSize * 2) + instructionSize);
    }
    return { incrementPC: false };
}

const processBLX = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`BLX (${type})`);
    // #REMOVE_IN_BUILD_END

    cpu.history.addError(`Unsupported BLX instruction: 0x${(i >>> 0).toString(16)}. This instruction is only available on ARMv5 and above.`);
    return { incrementPC: false };

}

const processBX = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('BX');
    // #REMOVE_IN_BUILD_END

    const rm = i & 0xF;
    const rmValue = cpu.getGeneralRegister(rm);
    const thumbModeSwitch = (rmValue & 0x1) === 1;
    const instructionSize = thumbModeSwitch ? 2 : 4;
    const pc = (rmValue + instructionSize * 2) & 0xFFFFFFFE;
    cpu.setStatusRegisterFlag('t', rmValue & 0x1);
    cpu.setGeneralRegister(Reg.PC, pc);
    return { incrementPC: false };
}

// Load & Store Instructions

const processLDR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDR');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    let value = cpu.memory.getInt32(wordAlignAddress(address));
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
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRB');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = cpu.memory.getInt8(address);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRBT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRBT');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    
    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    const address = getLoadStoreAddress(cpu, i & 0xFFDFFFFF);
    const value = cpu.memory.getInt8(address);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRH');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = cpu.memory.getInt16(halfWordAlignAddress(address));
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRSB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRSB');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = signExtend(cpu.memory.getInt8(address), 8);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRSH = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRSH');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const value = signExtend(cpu.memory.getInt16(halfWordAlignAddress(address)), 16);
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processLDRT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('LDRT');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;

    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    const address = getLoadStoreAddress(cpu, i & 0xFFDFFFFF);
    let value = cpu.memory.getInt32(wordAlignAddress(address));
    switch (address & 0x3) {
        case 0b01: value = rotateRight(value, 8, 32); break;
        case 0b10: value = rotateRight(value, 16, 32); break;
        case 0b11: value = rotateRight(value, 24, 32); break;
    }
    cpu.setGeneralRegister(rd, value);
    return { incrementPC: true };
}

const processSTR = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('STR');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = int32ToByteArray(cpu.getGeneralRegister(rd), cpu.bigEndian);
    cpu.setBytesInMemory(wordAlignAddress(address), bytes);
    return { incrementPC: true };
}

const processSTRB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('STRB');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([cpu.getGeneralRegister(rd) & 0xFF]);
    cpu.setBytesInMemory(address, bytes);
    return { incrementPC: true };
}

const processSTRBT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('STRBT');
    // #REMOVE_IN_BUILD_END

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
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('STRH');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 12) & 0xF;
    const rdValue = cpu.getGeneralRegister(rd);
    const address = getLoadStoreAddress(cpu, i);
    const bytes = new Uint8Array([rdValue & 0xFF, (rdValue >> 8) & 0xFF]);
    if (cpu.bigEndian) bytes.reverse();
    cpu.setBytesInMemory(address, bytes);
    return { incrementPC: true };
}

const processSTRT = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('STRT');
    // #REMOVE_IN_BUILD_END

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

/**
 * The specification states that LDM (3) always includes PC in the register list, as bit
 * 15 is set to 1. In practice, some ROMs do not include R15 in the register list, so
 * this implementation treats the PC as optional for LDM (3).
 */
const processLDM = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`LDM (${type})`);
    // #REMOVE_IN_BUILD_END

    const [startAddress, endAddress] = getLoadStoreMultipleAddress(cpu, i);
    const regList = (i & 0xFFFF);
    let address = wordAlignAddress(startAddress);

    switch (type) {
        case 1:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    const riValue = cpu.memory.getInt32(address);
                    cpu.setGeneralRegister(i, riValue);
                    address += 4;
                }
            }
            if (((regList >>> 15) & 0x1) === 1) {
                const value = cpu.memory.getInt32(address);
                const newPC = value & 0xFFFFFFFC;
                cpu.setGeneralRegister(Reg.PC, newPC);
                address += 4;
            }
            break;
        case 2:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    const riValue = cpu.memory.getInt32(address);
                    if (cpu.operatingMode === OperatingModes.usr || i <= 7) {
                        cpu.setGeneralRegister(i, riValue);
                    } else {
                        cpu.generalRegisters[OperatingModes.usr][i] = riValue;
                    }
                    address += 4;
                }
            }
            break;
        case 3:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    const riValue = cpu.memory.getInt32(address);
                    if (cpu.operatingMode === OperatingModes.usr || i <= 7) {
                        cpu.setGeneralRegister(i, riValue);
                    } else {
                        cpu.generalRegisters[OperatingModes.usr][i] = riValue;
                    }
                    address += 4;
                }
            }
            cpu.spsrToCPSR();
            if ((i >> 15) & 0x1) {
                const value = cpu.memory.getInt32(address);
                const t = cpu.getStatusRegisterFlag('CPSR', 't');
                const newPC = t === 1 ?
                    value & 0xFFFFFFFE :
                    value & 0xFFFFFFFC;
                cpu.setGeneralRegister(Reg.PC, newPC);
                address += 4;
            }
            break;
    }

    if (address - 4 !== endAddress) {
        throw Error(`LDM (${type}) failure: address ${address - 4} does not match expected end address ${endAddress}`);
    }

    // TODO: LDM can modify PC, in which case increment PC should be false
    return { incrementPC: true };
}

const processSTM = (cpu: CPU, i: number, type: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`STM (${type})`);
    // #REMOVE_IN_BUILD_END

    const [startAddress, endAddress] = getLoadStoreMultipleAddress(cpu, i);
    const regList = i & 0xFFFF;
    let address = startAddress;
    for (let i = 0; i <= 15; i++) {
        if (((regList >> i) & 0x1) === 1) {
            const riValue = type === 1 ?
                cpu.getGeneralRegister(i) :
                cpu.getGeneralRegisterByMode(i, OperatingModes.usr);
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
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MUL');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 16) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const result = (cpu.getGeneralRegister(rm) * cpu.getGeneralRegister(rs)) & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);
    if (sFlag) {
        cpu.setStatusRegisterFlag('n', isNegative32(result));
        cpu.setStatusRegisterFlag('z', result === 0);
    }
    return { incrementPC: true };
}

const processMLA = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MLA');
    // #REMOVE_IN_BUILD_END

    const rd = (i >>> 16) & 0xF;
    const rn = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const result = (cpu.getGeneralRegister(rm) * cpu.getGeneralRegister(rs) + cpu.getGeneralRegister(rn)) & 0xFFFFFFFF;
    cpu.setGeneralRegister(rd, result);
    if (sFlag) {
        cpu.setStatusRegisterFlag('n', isNegative32(result));
        cpu.setStatusRegisterFlag('z', result === 0);
    }
    return { incrementPC: true };
}

const processSMULL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SMULL');
    // #REMOVE_IN_BUILD_END

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
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue));
        cpu.setStatusRegisterFlag('z', rdHiValue === 0 && rdLoValue === 0);
    }
    return { incrementPC: true };
}

const processUMULL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('UMULL');
    // #REMOVE_IN_BUILD_END

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
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue));
        cpu.setStatusRegisterFlag('z', rdHiValue === 0 && rdLoValue === 0);
    }
    return { incrementPC: true };
}

const processSMLAL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SMLAL');
    // #REMOVE_IN_BUILD_END

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
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue));
        cpu.setStatusRegisterFlag('z', rdLoValue === 0 && rdHiValue === 0);
    }
    return { incrementPC: true };
}

const processUMLAL = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('UMLAL');
    // #REMOVE_IN_BUILD_END

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
        cpu.setStatusRegisterFlag('n', isNegative32(rdHiValue));
        cpu.setStatusRegisterFlag('z', rdHiValue === 0 && rdLoValue === 0);
    }
    return { incrementPC: true };
}

// Miscellaneous Arithmetic Instructions

 const processCLZ = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('CLZ');
    // #REMOVE_IN_BUILD_END

    cpu.history.addError(`CLZ instruction (0x${i.toString(16)}) is only supported in architecture version 5 and above.`);
    return { incrementPC: true };
 }

 // Status Register Instructions

const processMRS = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('MRS');
    // #REMOVE_IN_BUILD_END

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
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName(`MSR`);
    // #REMOVE_IN_BUILD_END

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
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SWP');
    // #REMOVE_IN_BUILD_END

    const rn = (i >>> 16) & 0xF;
    const rnValue = cpu.getGeneralRegister(rn);
    const rd = (i >>> 12) & 0xF;
    const rm = i & 0xF;
    const rmValue = cpu.getGeneralRegister(rm);

    const address = wordAlignAddress(rnValue);

    let temp = cpu.memory.getInt32(address);
    if ((rnValue & 0x3) === 0x0) {
    } else if ((rnValue & 0x3) === 0x1) {
        temp = rotateRight(temp, 8, 32);
    } else if ((rnValue & 0x3) === 0x2) {
        temp = rotateRight(temp, 16, 32);
    } else if ((rnValue & 0x3) === 0x3) {
        temp = rotateRight(temp, 24, 32);
    }

    cpu.setBytesInMemory(address, int32ToByteArray(rmValue, cpu.bigEndian));
    cpu.setGeneralRegister(rd, temp);

    return { incrementPC: true };
}

const processSWPB = (cpu: CPU, i: number) : ProcessedInstructionOptions => {
    // #REMOVE_IN_BUILD_START
    cpu.history.setInstructionName('SWPB');
    // #REMOVE_IN_BUILD_END

    const rn = (i >>> 16) & 0xF;
    const rnValue = cpu.getGeneralRegister(rn);
    const rd = (i >>> 12) & 0xF;
    const rm = i & 0xF;
    const rmValue = cpu.getGeneralRegister(rm);

    // Address is not word aligned when accessing a single byte.
    const address = rnValue;

    const temp = cpu.memory.getInt8(address);
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
