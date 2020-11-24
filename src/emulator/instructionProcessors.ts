import { CPU } from './cpu';
import { rotateRight } from './math';

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

    const value1 = cpu.generalRegisters[rn];
    const value2 = getShiftOperandValue(cpu, i, iFlag);
    let result: number = 0;
    switch(opcode) {
        case 0b0100: result = processAdd(cpu, value1, value2, rd); break;
        case 0b0010: result = processSub(cpu, value1, value2, rd); break;
    }

    if (sFlag) {
        if (result === 0) {
            cpu.updateStatusRegister({z: true});
        } else if (result < 0) {
            cpu.updateStatusRegister({n: true});
        } else {
            cpu.updateStatusRegister({});
        }
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
            const rs = (i >>> 8) && 0xF;
            shiftAmount = cpu.generalRegisters[rs];
        } else {
            // Rm shifted by immediate value
            const imm = (i >>> 7) & 0x1F;
            shiftAmount = imm;
        }

        switch (shiftType) {
            case 0x0:
                // Logical shift left
                return cpu.generalRegisters[rm] << shiftAmount;
            case 0x1:
                // Logical shift right
                return cpu.generalRegisters[rm] >>> shiftAmount;
            case 0x2:
                // Arithmetic shift right
                return cpu.generalRegisters[rm] >> shiftAmount;
            case 0x3:
                // Rotate right
                return rotateRight(cpu.generalRegisters[rm], shiftAmount, 32);
            default:
                console.log(`InstructionProcessor.getShiftOperandValue: illegal shiftType ${shiftType} from instruction ${i}`);
                return 0;
        }
    }
}

const processAdd = (cpu: CPU, value1: number, value2: number, rd: number) : number => {
    cpu.generalRegisters[rd] = value1 + value2;
    return cpu.generalRegisters[rd];
}

const processSub = (cpu: CPU, value1: number, value2: number, rd: number) : number => {
    cpu.generalRegisters[rd] = value1 - value2;
    return cpu.generalRegisters[rd];
}

export { process }