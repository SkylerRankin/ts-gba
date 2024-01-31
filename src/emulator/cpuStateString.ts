import { OperatingState, OperatingMode } from './cpu';

class CPUStateString {

    state = 'ARM';
    mode = 'USR';
    nzcv = '0000';
    registers = new Array<number>(16).fill(0);

    constructor() {

    }

    setState(s: OperatingState) : CPUStateString {
        this.state = s === 'THUMB' ? 'THB' : s;
        return this;
    }

    setMode(s: OperatingMode) : CPUStateString {
        this.mode = s.toUpperCase();
        return this;
    }

    setNZCV(value: number) : CPUStateString {
        this.nzcv = value.toString(2).padStart(4, '0');
        return this;
    }

    setRegister(reg: number, value: number) : CPUStateString {
        this.registers[reg] = value;
        return this;
    }

    build() : string {
        const regs = this.state === 'THB' ?
            [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 15].reduce((acc, value, i) => acc + (i ? ', ' : '') + (this.registers[value] >>> 0).toString(16).padStart(8, '0'), '') :
            this.registers.reduce((acc, value, i) => acc + (i ? ', ' : '') + (value >>> 0).toString(16).padStart(8, '0'), '');

        const stateString = `${this.state} ${this.mode} NZCV:[${this.nzcv}] Reg:[${regs}]`;
        return stateString;
    }

}

const createStateString = () => new CPUStateString();

export { CPUStateString, createStateString }
