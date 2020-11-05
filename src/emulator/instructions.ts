type InstructionType = 'adc' | 'add' | 'undefined';

type InstructionData = {
    type: InstructionType,              // The instruction type
    bitString: string                   // A bit string representation
    cond: ConditionCodeType             // The condition code 2 letter abbreviation
    sFlag: boolean,                     // True if the S flag was present
    rn?: number,                         // The Rn register, if specified
    rd?: number,                         // The Rd register, if specified
    shiftOperand?: ShiftOperandData     // Info about the shift argument, if present
}

const Instruction = {
    UNDEFINED: 'undefined',
    ADC: 'adc',
    ADD: 'add',
    AND: 'and',
    B: 'b',
    BL: 'bl',
    BIC: 'bic',
    BKPT: 'bkpt',
    BLX: 'blx',
    CDP: 'cdp',
    CLZ: 'clz',
    CMN: 'cmn',
    CMP: 'cmp',
    EOR: 'eor',
    LDC: 'ldc',
    LDM: 'ldm',
    LDR: 'ldr',
    LDRB: 'ldrb',
    LDRBT: 'ldrbt',
    LDRH: 'ldrh',
    LDRSB: 'ldrsb',
    LDRSH: 'ldrsh',
    LDRT: 'ldrt',
    MCR: 'mcr',
    MLA: 'mla',
    MOV: 'mov',
    MRC: 'mrc',
    MRS: 'mrs',
    MUL: 'mul',
    MVN: 'mvn',
    ORR: 'orr',
    RSB: 'rsb',
    RSC: 'rsc',
    SBC: 'sbc',
    SMLAL: 'smlal',
    SMULL: 'smull',
    STC: 'stc',
    STM: 'stm',
    STR: 'str',
    STRB: 'strb',
    STRBT: 'strbt',
    STRH: 'strh',
    STRT: 'strt',
    SUB: 'sub',
    SWI: 'swi',
    SWP: 'swp',
    SWPB: 'swpb',
    TEQ: 'teq',
    TST: 'tst',
    UMLAL: 'umlal',
    UMULL: 'umull'
};

// Options for the <shift_operand> section of the data processing instructions.

type DataProcessingOperandType = "Undefined" |
    "Imm" | "Reg" | "LSL by Imm" | "LSL by Reg" | "LSR by Imm" | "LSR by Reg" |
    "ASR by Imm" | "ASR by Reg" | "Rot by Imm" | "Rot by Reg" | "Rot by Ext";

const DataProcessingOperandValue : {[key: string] : DataProcessingOperandType} = {
    Immediate: "Imm",
    Register: "Reg",
    LogicalShiftLeftByImmediate: "LSL by Imm",
    LogicalShiftLeftByRegister: "LSL by Reg",
    LogicalShiftRightByImmediate: "LSR by Imm",
    LogicalShiftRightByRegister: "LSR by Reg",
    ArithmeticShiftRightByImmediate: "ASR by Imm",
    ArithmeticShiftRightByRegister: "ASR by Reg",
    RotateRightByImmediate: "Rot by Imm",
    RotateRightByRegister: "Rot by Reg",
    RotateRightWithExtend: "Rot by Ext"
};

type ShiftOperandData = {
    type: DataProcessingOperandType,
    values: string[]
}

type ConditionCodeType = 'eq' | 'ne' | 'cs' | 'hs' | 'cc' | 'lo' | 'mi' | 'pl' | 'vs' | 'vc' | 'hi' | 'ls' | 'ge' | 'lt' | 'gt' | 'le' | 'al' | 'nv';
const ConditionCodeValue : {[key: string] : string} = {
    EQ: '0000',
    NE: '0001',
    CS: '0010',
    HS: '0010',
    CC: '0011',
    LO: '0011',
    MI: '0100',
    PL: '0101',
    VS: '0110',
    VC: '0111',
    HI: '1000',
    LS: '1001',
    GE: '1010',
    LT: '1011',
    GT: '1100',
    LE: '1101',
    AL: '1110',
    NV: '1111'
};

const Encoding = {
    ADC: '<cond>00<i>0101<s><rn><rd><shift_operand>',
    ADD: '<cond>00<i>0100<s><rn><rd><shifter_operand>'
}

export { Instruction, Encoding, ConditionCodeValue, DataProcessingOperandValue };
export type { InstructionData, DataProcessingOperandType, ShiftOperandData, ConditionCodeType, InstructionType }