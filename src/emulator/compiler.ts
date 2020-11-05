import { Instruction, InstructionType, ConditionCodeType, ConditionCodeValue, ShiftOperandData, DataProcessingOperandValue } from './instructions';

const compileInstruction = (line:string) : number => {
    console.log(`Compiling ${line}`);
    let i = 1;
    while (!Object.keys(Instruction).includes(line.substring(0, i)) && i < 6) i++;
    while (Object.keys(Instruction).includes(line.substring(0, i + 1))) i++;
    const name: InstructionType = line.substring(0, i).toLowerCase() as InstructionType;

    switch (name) {
        case 'add': return compileAdd(line);
    }

    return 0;
}

const parseShiftOperand = (s: string) : ShiftOperandData => {
    s = s.toLowerCase().trim();
    const patterns = [
        /^#([\dx]+)$/,
        /^r(\d+)$/,
        /^r(\d+), (lsl) #(\d+)$/,
        /^r(\d+), (lsl) r(\d+)$/,
        /^r(\d+), (lsr) #(\d+)$/,
        /^r(\d+), (lsr) r(\d+)$/,
        /^r(\d+), (asr) #(\d+)$/,
        /^r(\d+), (asr) r(\d+)$/,
        /^r(\d+), (ror) #(\d+)$/,
        /^r(\d+), (ror) r(\d+)$/,
        /^r(\d+), (rrx)$/
    ];

    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = pattern.exec(s);
        if (match) {
            let fields = [];
            for (let i = 1; i < match.length; i++) fields.push(match[i]);
            let data: ShiftOperandData = {
                type: Object.values(DataProcessingOperandValue)[i],
                values: fields
            };
            return data;
        }
    }

    throw "Failed to parse shift operand: " + s;
}

// Converts a shift operand into its bit-string representation, as well as says what the 'i' flag value should be.
const shiftOperandToString = (d: ShiftOperandData) : string => {
    switch (d.type) {
        case DataProcessingOperandValue.Immediate:
            const value = parseInt(d.values[0]);
            let rotate = 0;
            let imm = 0;
            if (value >= 0 && value <= 0xFF) {
                imm = value;
            } else {
                
            }
            return rotate.toString(2).padStart(4, '0') + imm.toString(2).padStart(8, '0');
    }
    return '';
}

// Functions to compile each instruction

const compileAdd = (s: string) : number => {
    const regex = /^add(\w{2})?(s)? r(\d), r(\d), ([\w,\s#]+)$/;
    const m = regex.exec(s.toLowerCase().trim());
    if (!m) { throw `Failed to parse ${s}`; }

    const condition = m[1] as ConditionCodeType || 'al';
    const sFlag = m[2] ? '1' : '0';
    const iFlag = '0';
    const rn = parseInt(m[3]).toString(2).padStart(4, '0');
    const rd = parseInt(m[4]).toString(2).padStart(4, '0');
    const shiftOperandData: ShiftOperandData = parseShiftOperand(m[5]);
    const shiftOperandString = shiftOperandToString(shiftOperandData);
    let bitString = ConditionCodeValue[condition.toUpperCase()] + '00' + iFlag + '0100' + sFlag + rn + rd + shiftOperandString;
    return parseInt(bitString);
}



export { compileInstruction };