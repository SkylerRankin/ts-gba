import { Instruction, InstructionType, ConditionCodeType, ConditionCodeValue, ShiftOperandData, DataProcessingOperandValue } from './instructions';
import { encodeWithRotation } from './math';
import { CPU } from './cpu';

const assembleAndLoadProgram = (lines: string[], cpu: CPU) => {
    
}

const assembleInstruction = (line:string) : number => {
    let i = 1;

    while (!Object.keys(Instruction).includes(line.toUpperCase().substring(0, i)) && i < 6) i++;
    while (Object.keys(Instruction).includes(line.substring(0, i + 1)) && i < line.length) i++;
    const name: InstructionType = line.substring(0, i).toLowerCase() as InstructionType;

    switch (name) {
        case 'adc': return assembleAdc(line);
        case 'add': return assembleAdd(line);
        case 'and': return assembleAnd(line);
        case 'b': return assembleB_Bl(line);
        case 'bl': return assembleB_Bl(line);
        case 'bic': return assembleBic(line);
        case 'bkpt': return assembleBkpt(line);
        case 'blx': return assembleBlx(line);
        case 'bx': return assembleBx(line);
        case 'cdp': return assembleCdp(line);
        case 'clz': return assembleClz(line);
        case 'cmn': return assembleCmn(line);
        case 'cmp': return assembleCmp(line);
        case 'eor': return assembleEor(line);
        case 'ldc': return assembleLdc(line);
        case 'ldm': return assembleLdm(line);
        case 'ldr': return assembleLdr(line);
        case 'ldrb': return assembleLdrb(line);
        case 'ldrbt': return assembleLdrbt(line);
        case 'ldrh': return assembleLdrh(line);
        case 'ldrsb': return assembleLdrsb(line);
        case 'ldrsh': return assembleLdrsh(line);
        case 'ldrt': return assembleLdrt(line);
        case 'mcr': return assembleMcr(line);
        case 'mla': return assembleMla(line);
        case 'mov': return assembleMov(line);
        case 'mrc': return assembleMrc(line);
        case 'mrs': return assembleMrs(line);
        case 'msr': return assembleMsr(line);
        case 'mul': return assembleMul(line);
        case 'mvn': return assembleMvn(line);
        case 'orr': return assembleOrr(line);
        case 'rsb': return assembleRsb(line);
        case 'rsc': return assembleRsc(line);
        case 'sbc': return assembleSbc(line);
        case 'smlal': return assembleSmlal(line);
        case 'smull': return assembleSmull(line);
        case 'stc': return assembleStc(line);
        case 'stm': return assembleStm(line);
        case 'str': return assembleStr(line);
        case 'strb': return assembleStrb(line);
        case 'strbt': return assembleStrbt(line);
        case 'strh': return assembleStrh(line);
        case 'strt': return assembleStrt(line);
        case 'sub': return assembleSub(line);
        case 'swi': return assembleSwi(line);
        case 'swp': return assembleSwp(line);
        case 'swpb': return assembleSwpb(line);
        case 'teq': return assembleTeq(line);
        case 'tst': return assembleTst(line);
        case 'umlal': return assembleUmlal(line);
        case 'umull': return assembleUmull(line);
    }
}

const parseShiftOperand = (s: string) : ShiftOperandData => {
    s = s.toLowerCase().trim();
    const patterns = [
        /^#([x\da-f]+)$/,
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

// Converts a shift operand into its bit-string representation. Returns an array [iFlag, shitOperandBitString]
const shiftOperandToString = (d: ShiftOperandData) : string[] => {
    const value = parseInt(d.values[0]);
    switch (d.type) {
        case DataProcessingOperandValue.Immediate:
            let [rotate, imm] = encodeWithRotation(value, 32, 4, 8);
            return ['1', rotate.toString(2).padStart(4, '0') + imm.toString(2).padStart(8, '0')];
        case DataProcessingOperandValue.Register:
            return ['0', '00000000' + value.toString(2).padStart(4, '0')];
        case DataProcessingOperandValue.LogicalShiftLeftByImmediate:
        case DataProcessingOperandValue.LogicalShiftLeftByRegister:
        case DataProcessingOperandValue.LogicalShiftRightByImmediate:
        case DataProcessingOperandValue.LogicalShiftRightByRegister:
        case DataProcessingOperandValue.ArithmeticShiftRightByImmediate:
        case DataProcessingOperandValue.ArithmeticShiftRightByRegister:
        case DataProcessingOperandValue.RotateRightByImmediate:
        case DataProcessingOperandValue.RotateRightByRegister:
        case DataProcessingOperandValue.RotateRightWithExtend:
            return [];
    }
    throw 'Invalid shift operand type';
}

// Functions to compile each instruction

const assembleAdc = (s: string) : number => {
    return 0;
}

const assembleAdd = (s: string) : number => {
    const regex = /^add(\w{2})?(s)? r(\d+), r(\d+), ([\w,\s#]+)$/;
    const m = regex.exec(s.toLowerCase().trim());
    if (!m) { throw `Assembler: Failed to parse ${s}`; }

    const condition = m[1] as ConditionCodeType || 'al';
    const sFlag = m[2] ? '1' : '0';
    const rd = parseInt(m[3]).toString(2).padStart(4, '0');
    const rn = parseInt(m[4]).toString(2).padStart(4, '0');
    const shiftOperandData: ShiftOperandData = parseShiftOperand(m[5]);
    const [iFlag, shiftOperandString] = shiftOperandToString(shiftOperandData);
    const bitString = ConditionCodeValue[condition.toUpperCase()] + '00' + iFlag + '0100' + sFlag + rn + rd + shiftOperandString;
    return parseInt(bitString, 2);
}

const assembleAnd = (s: string) : number => {
    return 0;
}

const assembleB_Bl = (s: string) : number => {
    const regex = /^b(l)?(\w{2})? #([a-z0-9]+)$/;
    const m = regex.exec(s.toLowerCase().trim());
    if (!m) { throw `Assembler: Failed to parse ${s}` }

    const lFlag = m[1] ? '1' : '0';
    const condition = m[2] as ConditionCodeType || 'al';
    const imm = parseInt(m[3]).toString(2).padStart(24, '0');;
    
    const bitString = ConditionCodeValue[condition.toUpperCase()] + '101' + lFlag + imm;
    console.log(bitString);
    return parseInt(bitString, 2);
}

const assembleBic = (s: string) : number => {
    return 0;
}

const assembleBkpt = (s: string) : number => {
    return 0;
}

const assembleBlx = (s: string) : number => {
    return 0;
}

const assembleBx = (s: string) : number => {
    return 0;
}

const assembleCdp = (s: string) : number => {
    return 0;
}

const assembleClz = (s: string) : number => {
    return 0;
}

const assembleCmn = (s: string) : number => {
    return 0;
}

const assembleCmp = (s: string) : number => {
    return 0;
}

const assembleEor = (s: string) : number => {
    return 0;
}

const assembleLdc = (s: string) : number => {
    return 0;
}

const assembleLdm = (s: string) : number => {
    return 0;
}

const assembleLdr = (s: string) : number => {
    return 0;
}

const assembleLdrb = (s: string) : number => {
    return 0;
}

const assembleLdrbt = (s: string) : number => {
    return 0;
}

const assembleLdrh = (s: string) : number => {
    return 0;
}

const assembleLdrsb = (s: string) : number => {
    return 0;
}

const assembleLdrsh = (s: string) : number => {
    return 0;
}

const assembleLdrt = (s: string) : number => {
    return 0;
}

const assembleMcr = (s: string) : number => {
    return 0;
}

const assembleMla = (s: string) : number => {
    return 0;
}

const assembleMov = (s: string) : number => {
    return 0;
}

const assembleMrc = (s: string) : number => {
    return 0;
}

const assembleMrs = (s: string) : number => {
    return 0;
}

const assembleMsr = (s: string) : number => {
    return 0;
}

const assembleMul = (s: string) : number => {
    const regex = /^mul(\w{2})?(s)? r(\d+), r(\d+), r(\d+)$/;
    const m = regex.exec(s.toLowerCase().trim());
    if (!m) { throw `Failed to parse ${s}`; }

    const condition = m[1] as ConditionCodeType || 'al';
    const sFlag = m[2] ? '1' : '0';
    const rd = parseInt(m[3]).toString(2).padStart(4, '0');
    const rm = parseInt(m[4]).toString(2).padStart(4, '0');
    const rs = parseInt(m[5]).toString(2).padStart(4, '0');
    const sbz = '0000';
    let bitString = ConditionCodeValue[condition.toUpperCase()] + '0000000' + sFlag + rd + sbz + rs + '1001' + rm;
    return parseInt(bitString, 2);
}

const assembleMvn = (s: string) : number => {
    return 0;
}

const assembleOrr = (s: string) : number => {
    return 0;
}

const assembleRsb = (s: string) : number => {
    return 0;
}

const assembleRsc = (s: string) : number => {
    return 0;
}

const assembleSbc = (s: string) : number => {
    return 0;
}

const assembleSmlal = (s: string) : number => {
    return 0;
}

const assembleSmull = (s: string) : number => {
    return 0;
}

const assembleStc = (s: string) : number => {
    return 0;
}

const assembleStm = (s: string) : number => {
    return 0;
}

const assembleStr = (s: string) : number => {
    return 0;
}

const assembleStrb = (s: string) : number => {
    return 0;
}

const assembleStrbt = (s: string) : number => {
    return 0;
}

const assembleStrh = (s: string) : number => {
    return 0;
}

const assembleStrt = (s: string) : number => {
    return 0;
}

const assembleSub = (s: string) : number => {
    const regex = /^sub(\w{2})?(s)? r(\d+), r(\d+), ([\w,\s#]+)$/;
    const m = regex.exec(s.toLowerCase().trim());
    if (!m) { throw `Failed to parse ${s}`; }

    const condition = m[1] as ConditionCodeType || 'al';
    const sFlag = m[2] ? '1' : '0';
    const rd = parseInt(m[3]).toString(2).padStart(4, '0');
    const rn = parseInt(m[4]).toString(2).padStart(4, '0');
    const shiftOperandData: ShiftOperandData = parseShiftOperand(m[5]);
    const [iFlag, shiftOperandString] = shiftOperandToString(shiftOperandData);
    let bitString = ConditionCodeValue[condition.toUpperCase()] + '00' + iFlag + '0010' + sFlag + rn + rd + shiftOperandString;
    return parseInt(bitString, 2);
}

const assembleSwi = (s: string) : number => {
    return 0;
}

const assembleSwp = (s: string) : number => {
    return 0;
}

const assembleSwpb = (s: string) : number => {
    return 0;
}

const assembleTeq = (s: string) : number => {
    return 0;
}

const assembleTst = (s: string) : number => {
    return 0;
}

const assembleUmlal = (s: string) : number => {
    return 0;
}

const assembleUmull = (s: string) : number => {
    return 0;
}

export { assembleInstruction };
