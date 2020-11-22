import { CPU } from './cpu';
import { rotateRight } from './math';

const process = (cpu: CPU, i: number) : void => {
    // Data processing instructions
    if ((i & 0x0C000000) === 0) processDataProcessing(cpu, i);

}

const processDataProcessing = (cpu: CPU, i: number) : void => {
    const opcode = (i >> 21) & 0x4;
    switch(opcode) {
        case 0b0100: return processAdd(cpu, i);
    }
}

const processAdd = (cpu: CPU, i: number) : void => {
    const rn = (i >>> 16) & 0xF;
    const rd = (i >>> 12) & 0xF;
    const immediate = ((i >> 25) & 0x1) === 1;
    const shiftOpcode = (i >>> 3) & 0x7;
    const data = (i >>> 6) & 0x1F;
    let op2 = 0;
    if (immediate) {
        const rotate = (i >> 8) & 0xF;
        const imm = i & 0xFF;
        op2 = rotateRight(imm, rotate * 2, 32);
    } else if (shiftOpcode === 0 && data === 0) {
        const rm = i & 0xF;
        op2 = cpu.generalRegisters[rm];
    } else {
        console.log('instructionProcessor.processAdd: unsupported shift operand');
    }

    const op1 = cpu.generalRegisters[rn];
    const result = op1 + op2;
    cpu.generalRegisters[rd] = result;

    console.log(`Processing ADD: ${op1} + ${op2} = ${result}`);
}

export { process }