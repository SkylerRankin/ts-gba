import { readFileSync } from "fs";
import { CPU, OperatingModeCodes, OperatingModeNames, StatusRegisterKey, cpsrBitOffsetMapping, statusRegisterFlags } from "../../emulator/cpu";
import { parseNumericLiteral } from "../../emulator/math";

const parseInstructionFileUpdateString = (text: string) => {
    const registerUpdates: { [key: number]: number; } = {};
    const cpsrUpdates: { [key: string]: number; } = {};
    const spsrUpdates: { [key: string]: number; } = {};
    text.split(",")
        .map(i => i.trim().toLowerCase())
        .filter(i => i.length > 0)
        .forEach(i => {
            const equalsIndex = i.indexOf("=");
            if (i.startsWith("r")) {
                const register = Number.parseInt(i.substring(1, equalsIndex));
                expect(register >= 0 && register <= 15).toBeTruthy();
                const value = Number.parseInt(i.substring(equalsIndex + 1)) >>> 0;
                registerUpdates[register] = value;
            } else {
                let flag = i.substring(0, equalsIndex);
                let spsr = false;

                if (flag.endsWith("_spsr")) {
                    flag = flag.substring(0, flag.length - 5);
                    spsr = true;
                }

                const validFlags = [...statusRegisterFlags, "operating_mode"];
                expect(validFlags.includes(flag)).toBeTruthy();
                const value = parseNumericLiteral(i.substring(equalsIndex + 1));

                if (spsr) {
                    spsrUpdates[flag] = value;
                } else {
                    cpsrUpdates[flag] = value;
                }
            }
        });
    return { registerUpdates, cpsrUpdates, spsrUpdates };
}

const getTestCases = (filePath: string) => {
    return readFileSync(filePath).toString()
        .split(/\r?\n/)
        .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
        .filter(i => !i.line.startsWith("#") && i.line.length > 0)
        .map(i => {
            let line = i.line;

            // Special lines for manually setting register/flag values.
            if (line.startsWith("SET")) {
                const {registerUpdates, cpsrUpdates, spsrUpdates} = parseInstructionFileUpdateString(line.substring(4).trim());
                return {
                    instruction: undefined,
                    registerUpdates,
                    cpsrUpdates,
                    spsrUpdates,
                    lineNumber: i.lineNumber
                };
            }

            const spaceIndex = line.indexOf(" ");
            const instruction = Number.parseInt(line.substring(0, spaceIndex)) >>> 0;
            let registerUpdates: { [key: number]: number; } = {};
            let cpsrUpdates: { [key: string]: number; } = {};
            let spsrUpdates: { [key: string]: number; } = {};

            const updatesIndex = line.indexOf("Updates=");
            if (updatesIndex !== -1) {
                let updatesText = line.substring(line.indexOf("[", updatesIndex) + 1, line.indexOf("]"));

                const updateObjects = parseInstructionFileUpdateString(updatesText);
                registerUpdates = updateObjects.registerUpdates;
                cpsrUpdates = updateObjects.cpsrUpdates;
                spsrUpdates = updateObjects.spsrUpdates;
            }

            return { instruction, registerUpdates, cpsrUpdates, spsrUpdates, lineNumber: i.lineNumber };
        });
}

const executeInstructionTestFile = (filePath: string, processingFunction: any) => {
    const cpu = new CPU();
    cpu.reset();
    
    const test_cases = getTestCases(filePath);
    test_cases.forEach(t => {
        if (!t.instruction) {
            // Manual register updates
            Object.entries(t.registerUpdates).forEach(([register, value]) => {
                cpu.setGeneralRegister(Number.parseInt(register), value);
            });

            // Manual CPSR updates
            Object.entries(t.cpsrUpdates).forEach(([flag, value]) => {
                if (flag === "operating_mode") {
                    cpu.setModeBits(value);
                } else {
                    expect(statusRegisterFlags.includes(flag as StatusRegisterKey)).toBeTruthy();
                    const conditionFlag = flag as StatusRegisterKey;
                    cpu.setStatusRegisterFlag(conditionFlag, value);
                }
            });

            // Manual SPSR updates
            Object.entries(t.spsrUpdates).forEach(([flag, value]) => {
                if (flag === "operating_mode") {
                    setSPSRMode(cpu, value);
                } else {
                    expect(statusRegisterFlags.includes(flag as StatusRegisterKey)).toBeTruthy();
                    const conditionFlag = flag as StatusRegisterKey;
                    setSPSRFlag(cpu, conditionFlag, value);
                }
            });
            return;
        }

        const previousRegisters = cpu.generalRegisters[0].map(v => v >>> 0);
        const previousCPSRFlags = statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('CPSR', f));
        const previousCPSRMode = cpu.getStatusRegister('CPSR') & 0x1F;
        const previousSPSRFlags = cpu.currentModeHasSPSR() ? statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('SPSR', f)) : null;
        const previousSPSRMode = cpu.currentModeHasSPSR() ? cpu.getStatusRegister("SPSR") & 0x1F : null;

        processingFunction(cpu, t.instruction);

        const updatedRegisters = cpu.generalRegisters[0].map(v => v >>> 0);
        const updatedCPSRFlags = statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('CPSR', f));
        const updatedCPSRMode = cpu.getStatusRegister('CPSR') & 0x1F;
        const updatedSPSRFlags = cpu.currentModeHasSPSR() ? statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('SPSR', f)) : null;
        const updatedSPSRMode = cpu.currentModeHasSPSR() ? cpu.getStatusRegister("SPSR") & 0x1F : null;

        const messagePrefix = `Line ${t.lineNumber}: 0x${t.instruction.toString(16)}:`;

        // Check registers
        for (let i = 0; i < 16; i++) {
            if (i in t.registerUpdates) {
                expect(
                    updatedRegisters[i],
                    `${messagePrefix} Expected R${i} to be updated to 0x${(t.registerUpdates[i] >>> 0).toString(16)}, but was 0x${updatedRegisters[i].toString(16)}.`
                ).toBe(t.registerUpdates[i]);
            } else {
                expect(
                    updatedRegisters[i],
                    `${messagePrefix} Expected R${i} to be unchanged with value 0x${(previousRegisters[i] >>> 0).toString(16)}, but was 0x${updatedRegisters[i].toString(16)}.`
                ).toBe(previousRegisters[i]);
            }
        }

        // Check CPSR flags
        statusRegisterFlags.forEach((flag, i) => {
            if (flag in t.cpsrUpdates) {
                expect(
                    updatedCPSRFlags[i],
                    `${messagePrefix} Expected flag ${flag} to be updated to ${t.cpsrUpdates[flag]}, but was ${updatedCPSRFlags[i]}.`
                ).toBe(t.cpsrUpdates[flag]);
            } else {
                expect(
                    updatedCPSRFlags[i],
                    `${messagePrefix} Expected flag ${flag} to be unchanged with value ${previousCPSRFlags[i]}, but was ${updatedCPSRFlags[i]}.`
                ).toBe(previousCPSRFlags[i]);
            }
        });

        // Check CPSR operating mode
        if ("operating_mode" in t.cpsrUpdates) {
            expect(
                updatedCPSRMode,
                `${messagePrefix} Expected operating mode to be updated to 0b${t.cpsrUpdates['operating_mode'].toString(2).padStart(5, '0')}, but was 0b${updatedCPSRMode.toString(2).padStart(5, '0')}.`
            ).toBe(t.cpsrUpdates["operating_mode"]);
        } else {
            expect(
                updatedCPSRMode,
                `${messagePrefix} Expected operating mode to be unchanged with value 0b${previousCPSRMode.toString(2).padStart(5, '0')}, but was 0b${updatedCPSRMode.toString(2).padStart(5, '0')}.`
            ).toBe(previousCPSRMode);
        }

        // Check SPSR flags
        statusRegisterFlags.forEach((flag, i) => {
            if (flag in t.spsrUpdates) {
                if (updatedSPSRFlags === null) {
                    fail(`Test case updates included SPSR flag updates (${t.spsrUpdates}), but updated CPU mode did not have SPSR access (${cpu.operatingMode}).`);
                }
                expect(
                    updatedSPSRFlags[i],
                    `${messagePrefix} Expected flag ${flag} to be updated to ${t.spsrUpdates[flag]}, but was ${updatedSPSRFlags[i]}.`
                ).toBe(t.spsrUpdates[flag]);
            } else {
                if (updatedSPSRFlags && previousSPSRFlags) {
                    expect(
                        updatedSPSRFlags[i],
                        `${messagePrefix} Expected flag ${flag} to be unchanged with value ${previousSPSRFlags[i]}, but was ${updatedSPSRFlags[i]}.`
                    ).toBe(previousSPSRFlags[i]);
                }   
            }
        });

        // Check SPSR operating mode
        if ("operating_mode" in t.spsrUpdates) {
            if (updatedSPSRMode) {
                expect(
                    updatedSPSRMode,
                    `${messagePrefix} Expected operating mode to be updated to 0b${t.spsrUpdates['operating_mode'].toString(2).padStart(5, '0')}, but was 0b${updatedSPSRMode.toString(2).padStart(5, '0')}.`
                ).toBe(t.spsrUpdates["operating_mode"]);
            } else {
                // Mode does not have SPSR...
            }
        } else {
            if (updatedSPSRMode && previousSPSRMode) {
                expect(
                    updatedSPSRMode,
                    `${messagePrefix} Expected operating mode to be unchanged with value 0b${previousSPSRMode.toString(2).padStart(5, '0')}, but was 0b${updatedSPSRMode.toString(2).padStart(5, '0')}.`
                ).toBe(previousSPSRMode);
            } else {
                // Previous and current modes do not both have SPSR...
            }
        }

    });
};

// Manually setting bits in the SPSR is not normally done, but is useful for setting up unit tests.
// Thus this function is not a part of the CPU class.
const setSPSRFlag = (cpu: CPU, flag: StatusRegisterKey, value: number) => {
    if (cpu.operatingMode == 'usr' || cpu.operatingMode === 'sys') {
        throw Error(`Cannot access SPSR in operating mode ${cpu.operatingMode}.`);
    }

    let spsr = cpu.getStatusRegister('SPSR');
    const mask = 1 << cpsrBitOffsetMapping[flag];

    if (value === 0) {
        spsr &= ~mask;
    } else {
        spsr |= mask;
    }

    const operatingModeIndex = OperatingModeNames.indexOf(cpu.operatingMode);
    cpu.statusRegisters[operatingModeIndex][1] = spsr;
}

const setSPSRMode = (cpu: CPU, value: number) => {
    if (cpu.operatingMode == 'usr' || cpu.operatingMode === 'sys') {
        throw Error(`Cannot access SPSR in operating mode ${cpu.operatingMode}.`);
    }

    if (Object.values(OperatingModeCodes).includes(value)) {
        const operatingModeIndex = OperatingModeNames.indexOf(cpu.operatingMode);
        cpu.statusRegisters[operatingModeIndex][1] &= ~0x1F;
        cpu.statusRegisters[operatingModeIndex][1] |= value;
    } else {
        throw Error(`Invalid mode bits ${value.toString(2)}`);
    }
}

export { executeInstructionTestFile };
