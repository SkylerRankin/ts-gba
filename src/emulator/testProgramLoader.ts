import { CPUType } from './cpu';
import { assembleInstruction } from './assembler';

const loadTest = (name: string, cpu: CPUType) => {
    if (name === 'add') add(cpu);
}

const add = (cpu: CPUType) => {
    const program = [
        'ADD R0, R0, #1',
        'ADD R1, R1, #2',
        'ADD R2, R0, R1',
        'ADD R0, R1, R2'
    ];
    let address = 0;
    program.forEach(instruction => {
        // cpu.rom[address++] = assembleInstruction(instruction);
    });
}

export { loadTest }