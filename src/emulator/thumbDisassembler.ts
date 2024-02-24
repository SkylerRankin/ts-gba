import { CPU, Reg } from './cpu';
import { isNegative } from './math';

const disassembleTHUMB = (cpu: CPU, i: number) : string => {

    // Exception Generating Instructions
    if (i >>> 8 === 0b10111110) return disassembleBKPT(cpu, i);
    if (i >>> 8 === 0b11011111) return disassembleSWI(cpu, i);

    // Branch Instructions
    if ((i >>> 12 & 0xF) === 0b1101) return disassembleB1(cpu, i);
    if ((i >>> 11 & 0x1F) === 0b11100) return disassembleB2(cpu, i);
    if ((i >>> 13 & 0x7) === 0b111) return disassembleBL_BLX1(cpu, i);
    if ((i >>> 7 & 0x1FF) === 0b010001110) return disassembleBX(cpu, i);
    if ((i >>> 7 & 0x1FF) === 0b010001111) return disassembleBLX2(cpu, i);

    // Data Processing Instructions
    if (i >>> 6 === 0b0100000101) return disassembleADC(cpu, i);
    if (i >>> 9 === 0b0001110) return disassembleADD1(cpu, i);
    if (i >>> 11 === 0b00110) return disassembleADD2(cpu, i);
    if (i >>> 9 === 0b0001100) return disassembleADD3(cpu, i);
    if (i >>> 8 === 0b01000100) return disassembleADD4(cpu, i);
    if (i >>> 11 === 0b10100) return disassembleADD5(cpu, i);
    if (i >>> 11 === 0b10101) return disassembleADD6(cpu, i);
    if (i >>> 7 === 0b101100000) return disassembleADD7(cpu, i);
    if (i >>> 6 === 0b0100000000) return disassembleAND(cpu, i);
    if (i >>> 11 === 0b00010) return disassembleASR1(cpu, i);
    if (i >>> 6 === 0b0100000100) return disassembleASR2(cpu, i);
    if (i >>> 6 === 0b0100001110) return disassembleBIC(cpu, i);
    if (i >>> 6 === 0b0100001011) return disassembleCMN(cpu, i);
    if (i >>> 11 === 0b00101) return disassembleCMP1(cpu, i);
    if (i >>> 6 === 0b0100001010) return disassembleCMP2(cpu, i);
    if (i >>> 8 === 0b01000101) return disassembleCMP3(cpu, i);
    if (i >>> 6 === 0b0100000001) return disassembleEOR(cpu, i);
    if (i >>> 11 === 0b00000) return disassembleLSL1(cpu, i);
    if (i >>> 6 === 0b0100000010) return disassembleLSL2(cpu, i);
    if (i >>> 11 === 0b00001) return disassembleLSR1(cpu, i);
    if (i >>> 6 === 0b0100000011) return disassembleLSR2(cpu, i);
    if (i >>> 11 === 0b00100) return disassembleMOV1(cpu, i);
    if (i >>> 6 === 0b0001110000) return disassembleMOV2(cpu, i);
    if (i >>> 8 === 0b01000110) return disassembleMOV3(cpu, i);
    if (i >>> 6 === 0b0100001101) return disassembleMUL(cpu, i);
    if (i >>> 6 === 0b0100001111) return disassembleMVN(cpu, i);
    if (i >>> 6 === 0b0100001001) return disassembleNEG(cpu, i);
    if (i >>> 6 === 0b0100001100) return disassembleORR(cpu, i);
    if (i >>> 6 === 0b0100000111) return disassembleROR(cpu, i);
    if (i >>> 6 === 0b0100000110) return disassembleSBC(cpu, i);
    if (i >>> 9 === 0b0001111) return disassembleSUB1(cpu, i);
    if (i >>> 11 === 0b00111) return disassembleSUB2(cpu, i);
    if (i >>> 9 === 0b0001101) return disassembleSUB3(cpu, i);
    if (i >>> 7 === 0b101100001) return disassembleSUB4(cpu, i);
    if (i >>> 6 === 0b0100001000) return disassembleTST(cpu, i);

    // Load Store Instructions
    if (i >>> 11 === 0b01101) return disassembleLDR1(cpu, i);
    if (i >>> 9 === 0b0101100) return disassembleLDR2(cpu, i);
    if (i >>> 11 === 0b01001) return disassembleLDR3(cpu, i);
    if (i >>> 11 === 0b10011) return disassembleLDR4(cpu, i);
    if (i >>> 11 === 0b01111) return disassembleLDRB1(cpu, i);
    if (i >>> 9 === 0b0101110) return disassembleLDRB2(cpu, i);
    if (i >>> 11 === 0b10001) return disassembleLDRH1(cpu, i);
    if (i >>> 9 === 0b0101101) return disassembleLDRH2(cpu, i);
    if (i >>> 9 === 0b0101011) return disassembleLDRSB(cpu, i);
    if (i >>> 9 === 0b0101111) return disassembleLDRSH(cpu, i);
    if (i >>> 11 === 0b01100) return disassembleSTR1(cpu, i);
    if (i >>> 9 === 0b0101000) return disassembleSTR2(cpu, i);
    if (i >>> 11 === 0b10010) return disassembleSTR3(cpu, i);
    if (i >>> 11 === 0b01110) return disassembleSTRB1(cpu, i);
    if (i >>> 9 === 0b0101010) return disassembleSTRB2(cpu, i);
    if (i >>> 11 === 0b10000) return disassembleSTRH1(cpu, i);
    if (i >>> 9 === 0b0101001) return disassembleSTRH2(cpu, i);

    // Load Store Multiple Instructions
    if (i >>> 11 === 0b11001) return disassembleLDMIA(cpu, i);
    if (i >>> 9 === 0b1011110) return disassemblePOP(cpu, i);
    if (i >>> 9 === 0b1011010) return disassemblePUSH(cpu, i);
    if (i >>> 11 === 0b11000) return disassembleSTMIA(cpu, i);

    return "Invalid";
}

const parseCondition = (condition: number) : string => {
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
        case 0b1110: { return "AL"; }
        case 0b1111: { return "NV"; }
        default: { return "???"; }
    }
}

// Branch Instructions

const disassembleB1 = (cpu: CPU, i: number) : string => {
    const condition = (i >>> 8) & 0xF;
    const imm = i & 0xFF;
    const pc = cpu.getGeneralRegister(Reg.PC);
    let offset;
    if (isNegative(imm, 8)) {
        offset = -1 * (((~imm) + 1) & 0xFF);
    } else {
        offset = imm;
    }
    const newPC = pc + (offset << 1);
    return `B${parseCondition(condition)} ${newPC.toString(16).padStart(8, '0')}`;
}

const disassembleB2 = (cpu: CPU, i: number) : string => {
    const imm = i & 0x7FF;
    const pc = cpu.getGeneralRegister(Reg.PC);
    let offset;
    if (isNegative(imm, 11)) {
        offset = -1 * (((~(imm << 1)) + 1) & 0x7FF);
    } else {
        offset = imm << 1;
    }
    const newPC = pc + offset;
    return `B ${newPC.toString(16).padStart(8, '0')}`;
}

const disassembleBL_BLX1 = (cpu: CPU, i: number) : string => {
    const instructionSize = 2;
    const h = (i >>> 11) & 0x3;
    const offset = i & 0x7FF;
    const pc = cpu.getGeneralRegister(Reg.PC);

    if (h === 0b10) {
        const signExtendedOffset = isNegative(offset, 11) ?
            -1 * ((~offset + 1) & 0x7FF) :
            offset;
        const lr = pc + ((signExtendedOffset) << 12);
        return `BL (10) LR=${lr.toString(16).padStart(8, '0')}`;
    } else if (h === 0b11) {
        const newPC = cpu.getGeneralRegister(Reg.LR) + (offset << 1) + (instructionSize * 2);
        const newLR = (pc - (instructionSize * 2) + 2) | 1;
        return `BL (11) LR=${newLR.toString(16).padStart(8, '0')} PC=${newPC.toString(16).padStart(8, '0')}`;
    }

    return "Unsupported";
}

const disassembleBX = (cpu: CPU, i: number) : string => {
    const h2 = (i >>> 6) & 0x1;
    const rm = ((i >>> 3) & 0x7) + (h2 << 3);
    return `BX R${rm}`;
}

const disassembleBLX2 = (cpu: CPU, i: number) : string => {
    return "Unsupported";
}

// Data Processing Instructions

const disassembleADC = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `ADC R${rd}, R${rm}`;
}

const disassembleADD1 = (cpu: CPU, i: number) : string => {
    const rd = i & 0x7;
    const rn = (i >>> 3) & 0x7;
    const imm = (i >>> 6) & 0x7;
    return `ADD R${rd}, R${rn}, #0x${imm.toString(16)}`;
}

const disassembleADD2 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `ADD R${rd}, #0x${imm.toString(16)}`;
}

const disassembleADD3 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `ADD R${rd}, R${rn}, R${rm}`;
}

const disassembleADD4 = (cpu: CPU, i: number) : string => {
    const h1 = (i >>> 7) & 0x1;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rdLow = i & 0x7;
    const rm = (h2 << 3) | rmLow;
    const rd = (h1 << 3) | rdLow;
    return `ADD R${rd}, R${rm}`;
}

const disassembleADD5 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `ADD R${rd}, PC, #0x${imm.toString(16)} * 4`;
}

const disassembleADD6 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `ADD R${rd}, SP, #0x${imm.toString(16)} * 4`;
}

const disassembleADD7 = (cpu: CPU, i: number) : string => {
    const rd = Reg.SP;
    const imm = i & 0x7F;
    return `ADD SP, #0x${imm.toString(16)} * 4`;
}

const disassembleAND = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `AND R${rd}, R${rm}`;
}

const disassembleASR1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `ASR R${rd}, R${rm}, #0x${imm.toString(16)}`;
}

const disassembleASR2 = (cpu: CPU, i: number) : string => {
    const rs = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `ASR R${rd}, R${rs}`;
}

const disassembleBIC = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `BIC R${rd}, R${rm}`;
}

const disassembleCMN = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    return `CMN R${rn}, R${rm}`;
}

const disassembleCMP1 = (cpu: CPU, i: number) : string => {
    const rn = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `CMP R${rn}, #0x${imm.toString(16)}`;
}

const disassembleCMP2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    return `CMP R${rn}, R${rm}`;
}

const disassembleCMP3 = (cpu: CPU, i: number) : string => {
    const h1 = (i >>> 7) & 0x1;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rnLow = i && 0x7;
    const rn = (h1 << 3) | rnLow;
    const rm = (h2 << 3) | rmLow;
    return `CMP R${rn}, R${rm}`;
}

const disassembleEOR = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `EOR R${rd}, R${rm}`;
}

const disassembleLSL1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LSL R${rd}, R${rm}, #0x${imm.toString(16)}`;
}

const disassembleLSL2 = (cpu: CPU, i: number) : string => {
    const rs = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LSL R${rd}, R${rs}`;
}

const disassembleLSR1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LSR R${rd}, R${rm}, #0x${imm.toString(16)}`;
}

const disassembleLSR2 = (cpu: CPU, i: number) : string => {
    const rs = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LSR R${rd}, R${rs}`;
}

const disassembleMOV1 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `MOV R${rd}, #0x${imm.toString(16)}`;
}

const disassembleMOV2 = (cpu: CPU, i: number) : string => {
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `MOV R${rd}, R${rn}`;
}

const disassembleMOV3 = (cpu: CPU, i: number) : string => {
    const h1 = (i >>> 7) & 0x1;
    const h2 = (i >>> 6) & 0x1;
    const rmLow = (i >>> 3) & 0x7;
    const rdLow = i & 0x7;
    const rm = (h2 << 3) | rmLow;
    const rd = (h1 << 3) | rdLow;
    return `MOV R${rd}, R${rm}`;
}

const disassembleMUL = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `MUL R${rd}, R${rm}`;
}

const disassembleMVN = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `MVN R${rd}, R${rm}`;
}

const disassembleNEG = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `NEG R${rd}, R${rm}`;
}

const disassembleORR = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `ORR R${rd}, R${rm}`;
}

const disassembleROR = (cpu: CPU, i: number) : string => {
    const rs = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `ROR R${rd}, R${rs}`;
}

const disassembleSBC = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `SBC R${rd}, R${rm}`;
}

const disassembleSUB1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `SUB R${rd}, R${rn}, #0x${imm.toString(16)}`;
}

const disassembleSUB2 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `SUB R${rd}, #0x${imm.toString(16)}`;
}

const disassembleSUB3 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `SUB R${rd}, R${rn}, R${rm}`;
}

const disassembleSUB4 = (cpu: CPU, i: number) : string => {
    const imm = i & 0x7F;
    return `SUB SP, #0x${imm.toString(16)} * 4`;
}

const disassembleTST = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 3) & 0x7;
    const rn = i & 0x7;
    return `TST R${rn}, R${rm}`;
}

// load / Store Instructions

const disassembleLDR1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDR R${rd}, [R${rn}, #0x${imm.toString(16)} * 4]`;
}

const disassembleLDR2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDR R${rd}, [R${rn}, R${rm}]`;
}

const disassembleLDR3 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `LDR R${rd}, [PC, #0x${imm.toString(16)} * 4]`;
}

const disassembleLDR4 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `LDR R${rd}, [SP, #0x${imm.toString(16)} * 4]`;
}

const disassembleLDRB1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDRB R${rd}, [R${rn}, #0x${imm.toString(16)}]`;
}

const disassembleLDRB2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDRB R${rd}, [R${rn}, R${rm}]`;
}

const disassembleLDRH1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDRH R${rd}, [R${rn}, #0x${imm.toString(16)} * 2]`;
}

const disassembleLDRH2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDRH R${rd}, [R${rn}, R${rm}]`;
}

const disassembleLDRSB = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDRSB R${rd}, [R${rn}, R${rm}]`;
}

const disassembleLDRSH = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `LDRSH R${rd}, [R${rn}, R${rm}]`;
}

const disassembleSTR1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `STR R${rd}, [R${rn}, #0x${imm.toString(16)} * 4]`;
}

const disassembleSTR2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `STR R${rd}, [R${rn}, R${rm}]`;
}

const disassembleSTR3 = (cpu: CPU, i: number) : string => {
    const rd = (i >>> 8) & 0x7;
    const imm = i & 0xFF;
    return `STR R${rd}, [SP, #0x${imm.toString(16)} * 4]`;
}

const disassembleSTRB1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `STRB R${rd}, [R${rn}, #0x${imm.toString(16)}]`;
}

const disassembleSTRB2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `STRB R${rd}, [R${rn}, R${rm}]`;
}

const disassembleSTRH1 = (cpu: CPU, i: number) : string => {
    const imm = (i >>> 6) & 0x1F;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `STRH R${rd}, [R${rn}, #0x${imm.toString(16)} * 2]`;
}

const disassembleSTRH2 = (cpu: CPU, i: number) : string => {
    const rm = (i >>> 6) & 0x7;
    const rn = (i >>> 3) & 0x7;
    const rd = i & 0x7;
    return `STRH R${rd}, [R${rn}, R${rm}]`;
}

// Load / Store Multiple Instructions

const disassembleLDMIA = (cpu: CPU, i: number) : string => {
    const rn = (i >>> 8) & 0x7;
    const regList = i & 0xFF;
    let registers = "";
    for (let reg = 0; reg <= 7; reg++) {
        if (((regList >>> reg) & 0x1) === 1) {
            if (registers.length > 0) registers += ", ";
            registers += `R${reg}`;
        }
    }

    return `LDMIA R${rn}!, {${registers}}`;
}

const disassemblePOP = (cpu: CPU, i: number) : string => {
    const r = (i >>> 8) & 0x1;
    const regList = i & 0xFF;
    let registers = "";
    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            if (registers.length > 0) registers += ", ";
            registers += `R${i}`;
        }
    }

    if (r === 1) {
        if (registers.length > 0) registers += ", ";
        registers += "PC";
    }

    return `POP {${registers}}`;
}

const disassemblePUSH = (cpu: CPU, i: number) : string => {
    const r = (i >>> 8) & 0x1;
    const regList = i & 0xFF;
    let registers = "";
    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            if (registers.length > 0) registers += ", ";
            registers += `R${i}`;
        }
    }

    if (r === 1) {
        if (registers.length > 0) registers += ", ";
        registers += "LR";
    }

    return `PUSH {${registers}}`;
}

const disassembleSTMIA = (cpu: CPU, i: number) : string => {
    const rn = (i >>> 8) & 0x7;
    const regList = i & 0xFF;
    let registers = "";
    for (let i = 0; i <= 7; i++) {
        if (((regList >>> i) & 0x1) === 1) {
            if (registers.length > 0) registers += ", ";
            registers += `R${i}`;
        }
    }

    return `STMIA R${rn}!, {${registers}}`;
}

// Exception Generating Instructions

const disassembleBKPT = (cpu: CPU, i: number) : string => {
    return `Not implemented`;
}

const disassembleSWI = (cpu: CPU, i: number) : string => {
    return `Not implemented`;
}


export { disassembleTHUMB }
