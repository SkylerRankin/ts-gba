import { CPU } from './cpu';
import { rotateRight, logicalShiftLeft, logicalShiftRight, arithmeticShiftRight } from './math';

const process = (cpu: CPU, i: number) : void => {
    // Data processing instructions
    if ((i & 0x0C000000) === 0) processDataProcessing(cpu, i);

}

const processDataProcessing = (cpu: CPU, i: number) : void => {
    const opcode = (i >>> 21) & 0xF;
    const sFlag = (i >>> 20) & 0x1;
    const iFlag = (i >>> 25) & 0x1;
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;

    const value1 = cpu.getGeneralRegister(rn);
    const value2 = getShiftOperandValue(cpu, i, iFlag);
    let result: number = 0;
    switch(opcode) {
        case 0b0100: result = processAdd(cpu, value1, value2, rd, sFlag); break;
        case 0b0010: result = processSub(cpu, value1, value2, rd, sFlag); break;
    }
}

const getShiftOperandValue = (cpu: CPU, i: number, iFlag: number) : number => {
    if (iFlag) {
        const rotate = (i >>> 8) & 0xF;
        const imm = i & 0xFF;
        return rotateRight(imm, rotate * 2, 32);
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
                return logicalShiftLeft(cpu.getGeneralRegister(rm), shiftAmount);
            case 0x1:
                // Logical shift right
                return logicalShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
            case 0x2:
                // Arithmetic shift right
                return arithmeticShiftRight(cpu.getGeneralRegister(rm), shiftAmount);
            case 0x3:
                // Rotate right
                return rotateRight(cpu.getGeneralRegister(rm), shiftAmount, 32);
            default:
                console.log(`InstructionProcessor.getShiftOperandValue: illegal shiftType ${shiftType} from instruction ${i}`);
                return 0;
        }
    }
}

const processAdd = (cpu: CPU, value1: number, value2: number, rd: number, sFlag: number) : number => {
    cpu.updateGeneralRegister(rd, (value1 + value2) & 0xFFFFFFFF);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result >= 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = result >>> 31, value1MSB = value1 >>> 31 , value2MSB = value2 >>> 31;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

const processSub = (cpu: CPU, value1: number, value2: number, rd: number, sFlag: number) : number => {
    cpu.updateGeneralRegister(rd, value1 - value2);
    const result = cpu.getGeneralRegister(rd);
    if (sFlag) {
        cpu.clearConditionCodeFlags();
        if (result === 0) cpu.setConditionCodeFlags('z');
        if (result < 0) cpu.setConditionCodeFlags('n');
        // Unsigned overflow
        if (result < 2**32 - 1) cpu.setConditionCodeFlags('c');
        // Signed overflow
        const resultMSB = result >>> 31, value1MSB = value1 >>> 31 , value2MSB = value2 >>> 31;
        if ((resultMSB && !value1MSB && !value2MSB) || (!resultMSB && value1MSB && value2MSB)) {
            cpu.setConditionCodeFlags('v');
        }
    }
    return result;
}

export { process }
