import { CPU, Reg } from './cpu';
import { rotateRight, signExtend } from './math';


const disassembleARM = (cpu: CPU, i: number, instructionAddress: number) : string => {
    const bits = (i >>> 0).toString(2).padStart(32, '0')
        .split('').map((x: string) : number => parseInt(x)).reverse();

    // Branch instructions
    if (((i >>> 4) & 0xFFFFFF) === 0x12FFF1) return disassembleBX(cpu, i, instructionAddress);
    if (((i >>> 25) & 0x7F) === 0x7D) return disassembleBLX(cpu, i, 1, instructionAddress);
    if (((i >>> 4) & 0xFFFFFF) === 0x12FFF3) return disassembleBLX(cpu, i, 2, instructionAddress);
    // Check for B/BL after BLX(1) due to overlap in bits 27:25
    if (((i >>> 25) & 0x7) === 0x5) return disassembleBBL(cpu, i, instructionAddress);

    // Load/store instructions
    if (((i >>> 26) & 0x3) === 0x1) {
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0x7) return disassembleLDRBT(cpu, i);
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0x3) return disassembleLDRT(cpu, i);
        if (bits[22] === 0 && bits[20] === 1) return disassembleLDR(cpu, i);
        if (bits[22] === 1 && bits[20] === 1) return disassembleLDRB(cpu, i);
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0b110) return disassembleSTRBT(cpu, i);
        if (bits[24] === 0 && ((i >>> 20) & 0x7) === 0b010) return disassembleSTRT(cpu, i);
        if (bits[22] === 0 && bits[20] === 0) return disassembleSTR(cpu, i);
        if (bits[22] === 1 && bits[20] === 0) return disassembleSTRB(cpu, i);
    } else if (((i >>> 25) & 0x7) === 0x0 && bits[20] === 1) {
        if (((i >>> 4) & 0xF) === 0xB) return disassembleLDRH(cpu, i);
        if (((i >>> 4) & 0xF) === 0xD) return disassembleLDRSB(cpu, i);
        if (((i >>> 4) & 0xF) === 0xF) return disassembleLDRSH(cpu, i);
    } else if (((i >>> 25) & 0x7) === 0x4) {
        if (bits[22] === 0 && bits[20] === 1) return disassembleLDM(cpu, i, 1);
        if (((i >>> 20) & 0x7) === 0x5 && bits[15] === 0) return disassembleLDM(cpu, i, 2);
        if (bits[22] === 1 && bits[20] === 1 && bits[15] === 1) return disassembleLDM(cpu, i, 3);
    }

    // Software Interrupt
    if (((i >>> 24) & 0xF) === 0xF) return disassembleSWI(cpu, i);

    // Breakpoint
    if (((i >>> 20) & 0xFFF) === 0b111000010010 && ((i >>> 4) & 0xF) === 0b0111) return disassembleBKPT(cpu, i);

    // MRS and MSR
    if (((i >>> 23) & 0x1F) === 0b00010 && ((i >>> 16) & 0x3F) === 0xF && (i & 0xFFF) === 0x0) {
        return disassembleMRS(cpu, i);
    }
    if (((i >>> 23) & 0x1F) === 0b00110 && ((i >>> 20) & 0x3) === 0x2 && ((i >>> 12) & 0xF) === 0xF) {
        return disassembleMSR(cpu, i, 1);
    } else if (((i >>> 23) & 0x1F) === 0b00010 && ((i >>> 20) & 0x3) === 0x2 && ((i >>> 4) & 0xFFF) === 0b111100000000) {
        return disassembleMSR(cpu, i, 2);
    }

    // Bits 27:25 = 000
    if (((i >>> 25) & 0x7) === 0x0) {
        // Store Register Halfword
        if (bits[20] === 0 && ((i >>> 4) & 0xF) === 0b1011) return disassembleSTRH(cpu, i);

        // Multiply Instructions
        if (((i >>> 21) & 0x7F) === 0x1 && ((i >>> 4) & 0xF) === 0b1001) return disassembleMLA(cpu, i);
        if (((i >>> 21) & 0x7F) === 0x0 && ((i >>> 12) & 0xF) === 0x0 && ((i >>> 4) & 0xF) === 0b1001) return disassembleMUL(cpu, i);
        if (((i >>> 23) & 0x1F) === 0x1 && ((i >>> 4) & 0xF) === 0b1001) {
            if (bits[22] === 0) {
                if (bits[21] === 0) {
                    return disassembleUMULL(cpu, i);
                } else {
                    return disassembleUMLAL(cpu, i);
                }
            } else {
                if (bits[21] === 0) {
                    return disassembleSMULL(cpu, i);
                } else {
                    return disassembleSMLAL(cpu, i);
                }
            }
        }

        // Swaps
        if (((i >>> 20) & 0xFF) === 0b00010000 && ((i >>> 4) & 0xFF) === 0b00001001) return disassembleSWP(cpu, i);
        if (((i >>> 20) & 0xFF) === 0b00010100 && ((i >>> 4) & 0xF) === 0b1001) return disassembleSWPB(cpu, i);
    }

    // Store Multiple
    if (((i >>> 25) & 0x7) === 0x4 && bits[22] === 0 && bits[20] === 0) return disassembleSTM(cpu, i, 1);
    if (((i >>> 25) & 0x7) === 0x4 && bits[22] === 1 && bits[20] === 0) return disassembleSTM(cpu, i, 2);

    // CLZ
    if (((i >>> 16) & 0xFFF) === 0b000101101111 && ((i >>> 4) & 0xFF) === 0b11110001) return disassembleCLZ(cpu, i);

    // Data processing instructions
    if ((i & 0x0C000000) === 0) return disassembleDataProcessing(cpu, i);

    return "Unknown";
}

const parseCondition = (i: number) : string => {
    const condition = i >>> 28;
    switch (condition) {
        case 0b0000: { return "EQ"; }
        case 0b0001: { return "NE"; }
        case 0b0010: { return "CS"; }
        case 0b0011: { return "CC"; }
        case 0b0100: { return "MI"; }
        case 0b0101: { return "PL"; }
        case 0b0110: { return "VS"; }
        case 0b0111: { return "VC"; }
        case 0b1000: { return "HI"; }
        case 0b1001: { return "LS"; }
        case 0b1010: { return "GE"; }
        case 0b1011: { return "LT"; }
        case 0b1100: { return "GT"; }
        case 0b1101: { return "LE"; }
        case 0b1110: { return ""; }
        case 0b1111: { return "NV"; }
        default: { return "???"; }
    }
}

const disassembleDataProcessing = (cpu: CPU, i: number) : string => {
    const opcode = (i >>> 21) & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;

    const functionName = [
        "AND", "EOR", "SUB", "RSB", "ADD", "ADC",
        "SBC", "RSC", "TST", "TEQ", "CMP", "CMN",
        "ORR", "MOV", "BIC", "MVN"
    ][opcode];

    const singleRegisterRn = ["CMP", "CMN", "TEQ", "TST"];
    const singleRegisterRd = ["MOV", "MVN"];

    const shiftOperand = parseShiftOperandValue(cpu, i);

    if (singleRegisterRn.includes(functionName)) {
        return `${functionName}${parseCondition(i)}${sFlagText} R${rn}, ${shiftOperand}`;
    } else if (singleRegisterRd.includes(functionName)) {
        return `${functionName}${parseCondition(i)}${sFlagText} R${rd}, ${shiftOperand}`;
    } else {
        return `${functionName}${parseCondition(i)}${sFlagText} R${rd}, R${rn}, ${shiftOperand}`;
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
const parseShiftOperandValue = (cpu: CPU, i: number) : string => {
    let value = 0;
    let carry = 0;
    let valueOffset = 0;
    const iFlag = (i >> 25) & 0x1;
    const cFlag = cpu.getStatusRegisterFlag('CPSR', 'c');

    if (iFlag) {
        const rotate = (i >>> 8) & 0xF;
        const imm = i & 0xFF;
        value = rotateRight(imm, rotate * 2, 32);
        return `#0x${(value >>> 0).toString(16)}`;
    } else if (((i >>> 4) & 0xFF) === 0) {
        // Single register operand without shift
        const rm = i & 0xF;
        return `R${rm}`;
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

        let shiftTypeText = "";
        let shiftValueText = "";

        let shiftAmount = 0;
        if (immediateShift) {
            // Rm shifted by immediate value
            const imm = (i >>> 7) & 0x1F;
            shiftValueText = `#0x${(imm >>> 0).toString(16)}`;
        } else {
            // Rm shifted by register value
            const rs = (i >>> 8) & 0xF;
            shiftValueText = `R${rs}`;
        }

        switch (shiftType) {
            case 0x0:
                // Logical shift left
                shiftTypeText = "LSL";
                break;
            case 0x1:
                // Logical shift right
                shiftTypeText = "LSR";
                break;
            case 0x2:
                // Arithmetic shift right
                shiftTypeText = "ASR";
                break;
            case 0x3:
                // Rotate right
                const rotationType = (i >> 4) & 0x1;
                if (rotationType === 1) {
                    shiftTypeText = "ROR";
                } else {
                    shiftTypeText = "RRX";
                    shiftValueText = "";
                }
                break;
            default:
                return "Invalid";
        }

        return `R${rm}, ${shiftTypeText} ${shiftValueText}`;
    }
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
const parseLoadStoreAddress = (cpu: CPU, i: number) : string => {
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
                return `[R${rn}, #${sign === 1 ? "+" : "-"}${offset.toString(16)}]`;
            } else if (p === 1 && w === 1) {
                // Immediate pre-indexed
                return `[R${rn}, #${sign === 1 ? "+" : "-"}${offset.toString(16)}]!`;
            } else if (p === 0 && w === 0) {
                // Immediate post-indexed
                return `[R${rn}], #${sign === 1 ? "+" : "-"}${offset.toString(16)}`;
            }
        } else {
            const sign = u === 1 ? 1 : -1;
            const signText = sign === 1 ? "+" : "-";
            const shiftImmediate = (i >>> 7) & 0x1F;
            const shiftType = (i >>> 5) & 0x3;
            const rm = i & 0xF;
            let index = 0;

            let shiftText = "";
            switch (shiftType) {
                case 0b00:
                    shiftText = "LSL";
                    break;
                case 0b01:
                    // LSR
                    shiftText = "LSR";
                    break;
                case 0b10:
                    // ASR
                    shiftText = "ASR";
                    break;
                case 0b11:
                    // ROR/RRX
                    if (shiftImmediate === 0) {
                        shiftText = "RRX";
                    } else {
                        shiftText = "ROR";
                    }
                    break;
            }

            if (p === 1 && w === 0) {
                // Register offset; does not set Rn
                return `[R${rn}, ${signText}R${rm}]`;
            } else if (p === 1 && w === 1) {
                // Register pre-indexed
                if (shiftImmediate === 0) {
                    return `[R${rn}, ${signText}R${rm}]!`;
                } else {
                    return `[R${rn}, ${signText}R${rm}, ${shiftText} #${shiftImmediate.toString(16)}]!`;
                }
            } else if (p === 0 && w === 0) {
                // Register post-indexed
                address = rnValue;
                if (shiftImmediate === 0) {
                    return `[R${rn}], ${signText}R${rm}`;
                } else {
                    return `[R${rn}], ${signText}R${rm}, ${shiftText} #${shiftImmediate.toString(16)}`;
                }
            }
        }
    } else if (mode === 3) {
        const immediate = bits[22] === 1;
        const sign = u === 1 ? 1 : -1;
        const signText = sign === 1 ? "+" : "-";
        let offset = 0;
        let offsetText = "";
        if (immediate) {
            const immediateHigh = (i >>> 8) & 0xF;
            const immediateLow = i & 0xF;
            offset = (immediateHigh << 4) | immediateLow;
            offsetText = `#${signText}${offset}`;
        } else {
            const rm = i & 0xF;
            offset = cpu.getGeneralRegister(rm);
            offsetText = `${signText}R${rm}`;
        }

        if (p === 1 && w === 0) {
            // Offset; does not change base register
            address = ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0;
            return `[R${rn}, ${offsetText}]`;
        } else if (p === 1 && w === 1) {
            // Pre-indexed
            address = ((rnValue + sign * offset) & 0xFFFFFFFF) >>> 0;
            return `[R${rn}, ${offsetText}]!`;
        } else if (p === 0 && w === 0) {
            // Post-indexed
            address = rnValue;
            return `[R${rn}], ${offsetText}`;
        }
    }

    return "invalid";
}

/**
 * Addressing Mode 4
 * Returns an array [startAddress, endAddress], marking the start and end
 * addresses to read/set a series of values in memory.
 */
const parseLoadStoreMultipleAddress = (cpu: CPU, i: number) : string => {
    const opcode = (i >>> 23) & 0x3;
    const w = (i >>> 21) & 0x1;
    const rn = (i >>> 16) & 0xF;
    const addressingMode = ["DA", "IA", "DB", "IB"][opcode];
    const wFlag = w === 1 ? "!" : "";
    return `${addressingMode} R${rn}${wFlag}`;
}

// Branch Instructions

const disassembleBBL = (cpu: CPU, i: number, instructionAddress: number) : string => {
    const lFlag = (i >>> 24) & 0x1;
    const instructionSize = 4;
    const imm = signExtend(i & 0xFFFFFF, 24);
    const pc = instructionAddress + instructionSize * 2;
    const newPC = pc + (imm << 2) + (instructionSize * 2);
    return `B${lFlag === 1 ? "L" : ""}${parseCondition(i)} ${(newPC).toString(16).padStart(8, "0")}`;
}

const disassembleBLX = (cpu: CPU, i: number, type: number, instructionAddress: number) : string => {
    return `Not supported`;

}

const disassembleBX = (cpu: CPU, i: number, instructionAddress: number) : string => {
    const rm = i & 0xF;
    return `BX${parseCondition(i)} R${rm}`;
}

// Load & Store Instructions

const disassembleLDR = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `LDR${parseCondition(i)} R${rd} ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleLDRB = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `LDR${parseCondition(i)}B R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleLDRBT = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;    
    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    return `LDR${parseCondition(i)}BT R${rd}, ${parseLoadStoreAddress(cpu, i & 0xFFDFFFFF)}`;
}

const disassembleLDRH = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `LDR${parseCondition(i)}H R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleLDRSB = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `LDR${parseCondition(i)}SB R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleLDRSH = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `LDR${parseCondition(i)}SH R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleLDRT = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    return `LDR${parseCondition(i)}T R${rd}, ${parseLoadStoreAddress(cpu, i & 0xFFDFFFFF)}`;
}

const disassembleSTR = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `STR${parseCondition(i)} R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleSTRB = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `STR${parseCondition(i)}B R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleSTRBT = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    return `STR${parseCondition(i)}BT R${rd}, ${parseLoadStoreAddress(cpu, i & 0xFFDFFFFF)}`;
}

const disassembleSTRH = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    return `STR${parseCondition(i)}H R${rd}, ${parseLoadStoreAddress(cpu, i)}`;
}

const disassembleSTRT = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 12) & 0xF;
    // The instruction only uses addressing mode 2 post indexing. But instead of having
    // the normal configuration of P == 0 and W == 0, W == 1 in this instruction. Setting
    // the W bit back to 0 before calculating the address handles this case as if it was
    // a normal post-indexed situation.
    return `STR${parseCondition(i)}T R${rd}, ${parseLoadStoreAddress(cpu, i & 0xFFDFFFFF)}`;
}

// Load & Store Multiple Instructions

const disassembleLDM = (cpu: CPU, i: number, type: number) : string => {
    const addressingMode = parseLoadStoreMultipleAddress(cpu, i);
    const regList = (i & 0xFFFF);
    let registers = "";

    switch (type) {
        case 1:
            for (let i = 0; i <= 15; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    if (registers.length > 0) registers += ", ";
                    registers += `R${i}`;
                }
            }
            return `LDM${parseCondition(i)}${addressingMode}, {${registers}}`;
        case 2:
            for (let i = 0; i <= 14; i++) {
                if (((regList >>> i) & 0x1) === 1) {
                    if (registers.length > 0) registers += ", ";
                    registers += `R${i}`;
                }
            }
            return `LDM${parseCondition(i)}${addressingMode}, {${registers}}^`;
        case 3:
            for (let i = 0; i <= 15; i++) {
                if (((regList >>> i) & 0x1) === 1 || i === 15) {
                    if (registers.length > 0) registers += ", ";
                    registers += `R${i}`;
                }
            }
            return `LDM${parseCondition(i)}${addressingMode}, {${registers}}^`;
    }

    return "invalid";
}

const disassembleSTM = (cpu: CPU, i: number, type: number) : string => {
    const addressingMode = parseLoadStoreMultipleAddress(cpu, i);
    let registers = "";
    const regList = i & 0xFFFF;
    for (let i = 0; i <= 15; i++) {
        if (((regList >> i) & 0x1) === 1) {
            if (registers.length > 0) registers += ", ";
            registers += `R${i}`;
        }
    }
    const userModeFlag = type === 2 ? "^" : "";

    return `STM${parseCondition(i)}${addressingMode}, ${registers}${userModeFlag}`;
}

// Multiply Instructions

const disassembleMUL = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 16) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    return `MUL${parseCondition(i)}${sFlagText} R${rd}, R${rm}, R${rs}`;
}

const disassembleMLA = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 16) & 0xF;
    const rn = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    return `MLA${parseCondition(i)}${sFlagText} R${rd}, R${rm}, R${rs}, R${rn}`;
}

const disassembleSMULL = (cpu: CPU, i: number) : string => {
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    return `SMULL${parseCondition(i)}${sFlagText} R${rdLo}, R${rdHi}, R${rm}, R${rs}`;
}

const disassembleUMULL = (cpu: CPU, i: number) : string => {
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    return `UMULL${parseCondition(i)}${sFlagText} R${rdLo}, R${rdHi}, R${rm}, R${rs}`;
}

const disassembleSMLAL = (cpu: CPU, i: number) : string => {
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    return `SMLAL${parseCondition(i)}${sFlagText} R${rdLo}, R${rdHi}, R${rm}, R${rs}`;
}

const disassembleUMLAL = (cpu: CPU, i: number) : string => {
    const rdHi = (i >>> 16) & 0xF;
    const rdLo = (i >>> 12) & 0xF;
    const rs = (i >>> 8) & 0xF;
    const rm = i & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const sFlagText = sFlag === 1 ? "S" : "";
    return `UMLAL${parseCondition(i)}${sFlagText} R${rdLo}, R${rdHi}, R${rm}, R${rs}`;
}

// Miscellaneous Arithmetic Instructions

 const disassembleCLZ = (cpu: CPU, i: number) : string => {
    return "Not supported";
 }

 // Status Register Instructions

const disassembleMRS = (cpu: CPU, i: number) : string => {
    const rFlag = (i >>> 22) & 0x1;
    const rd = (i >> 12) & 0xF;
    const register = rFlag === 1 ? "SPSR" : "CPSR";
    return `MRS${parseCondition(i)} R${rd}, ${register}`;
}

const disassembleMSR = (cpu: CPU, i: number, type: number) : string => {
    // type = 1 => immediate operand, 2 => register operand
    let operand;
    if (type === 1) {
        const rotation = ((i >>> 8) & 0xF) * 2;
        const imm = i & 0xFF;
        const operandValue = rotateRight(imm, rotation, 32);
        operand = `#0x${operandValue.toString(16)}`;
    } else {
        const rm = i & 0xF;
        operand = `R${rm}`;
    }

    const rFlag = (i >>> 22) & 0x1;
    const register = rFlag === 0 ? "CPSR" : "SPSR";

    const fieldMask = (i >>> 16) & 0xF;
    let fields = "";
    if (fieldMask & 0x1) fields += "c";
    if (fieldMask & 0x2) fields += "x";
    if (fieldMask & 0x4) fields += "s";
    if (fieldMask & 0x8) fields += "f";

    return `MSR${parseCondition(i)} ${register}_${fields}, ${operand}`;
}

// Semaphore Instructions

const disassembleSWP = (cpu: CPU, i: number) : string => {
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;
    const rm = i & 0xF;
    return `SWP${parseCondition(i)} R${rd}, R${rm}, [R${rn}]`;
}

const disassembleSWPB = (cpu: CPU, i: number) : string => {
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;
    const rm = i & 0xF;
    return `SWP${parseCondition(i)}B R${rd}, R${rm}, [R${rn}]`;
}

// Exception Generating Instructions

const disassembleBKPT = (cpu: CPU, i: number) : string => {
    const imm = (((i >> 8) & 0xFFF) << 12) | (i & 0xF);
    return `BKPT #0x${imm.toString(16)}`;
}

const disassembleSWI = (cpu: CPU, i: number) : string => {
    const imm = i & 0xFFFFFF;
    return `SWI${parseCondition(i)} #0x${imm.toString(16)}`;
}


export { disassembleARM }
