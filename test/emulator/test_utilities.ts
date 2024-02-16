import { readFileSync, writeFileSync } from "fs";
import { CPU, OperatingModeCodes, OperatingModeNames, OperatingModes, StatusRegisterKey, cpsrBitOffsetMapping, statusRegisterFlags } from "../../src/emulator/cpu";
import { parseNumericLiteral } from "../../src/emulator/math";
import { getLoadStoreAddress, getLoadStoreMultipleAddress } from "../../src/emulator/armInstructionProcessors";
import { Memory } from "../../src/emulator/memory";
import { Display, DisplaySize, RGBColor } from "../../src/emulator/display";
import { byteArrayToBitmap } from "../../src/emulator/image";

const parseInstructionFileUpdateString = (text: string) => {
    const registerUpdates: { [key: string]: number } = {};
    const cpsrUpdates: { [key: string]: number; } = {};
    const spsrUpdates: { [key: string]: number; } = {};
    text.split(",")
        .map(i => i.trim().toLowerCase())
        .filter(i => i.length > 0)
        .forEach(i => {
            const equalsIndex = i.indexOf("=");
            if (i.startsWith("r")) {
                const register = "R" + i.substring(1, equalsIndex);
                const value = parseNumericLiteral(i.substring(equalsIndex + 1)) >>> 0;
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

const parseMemoryUpdateString = (text: string) => {
    const originalText = text;
    const memoryUpdates: {[key: number]: Uint8Array} = {};

    while (text.length > 0) {
        const bracketIndex = text.indexOf("]");
        let section = text.substring(0, bracketIndex);
        text = text.substring(bracketIndex + 1).trim();
        if (text.startsWith(",")) text = text.substring(1).trim();

        const address = parseNumericLiteral(section.substring(0, section.indexOf("=")));
        section = section.substring(section.indexOf("[") + 1);

        if (address in memoryUpdates) {
            throw Error(`Duplicate address (0x${address.toString(16)}) in memory update string: ${originalText}.`);
        }

        const bytes = section.split(",").map(i => {
            return parseNumericLiteral(i.trim());
        });

        bytes.forEach(b => {
            if (b > 255) {
                throw Error(`Byte (${b}) is too large in memory update string: ${originalText}.`);
            }
        });

        memoryUpdates[address] = new Uint8Array(bytes);
    }

    return memoryUpdates;
}

const getTestCases = (filePath: string) => {
    return readFileSync(filePath).toString()
        .split(/\r?\n/)
        .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
        .filter(i => !i.line.startsWith("#") && i.line.length > 0)
        .map(i => {
            let line = i.line;

            // Special lines for manually setting memory
            if (line.startsWith("SET_MEMORY") || line.startsWith("CHECK_MEMORY")) {
                const memoryUpdates = parseMemoryUpdateString(line.substring(line.indexOf("MEMORY") + 6).trim());
                return {
                    instruction: undefined,
                    memoryUpdates,
                    setMemory: line.startsWith("SET_MEMORY"),
                    checkMemory: line.startsWith("CHECK_MEMORY"),
                    registerUpdates: {},
                    cpsrUpdates: {},
                    spsrUpdates: {},
                    lineNumber: i.lineNumber
                };
            }

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
            let registerUpdates: { [key: string]: number } = {};
            let cpsrUpdates: { [key: string]: number; } = {};
            let spsrUpdates: { [key: string]: number; } = {};

            const updatesIndex = line.indexOf("Updates=");
            if (updatesIndex !== -1) {
                const updatesText = line.substring(line.indexOf("[", updatesIndex) + 1, line.indexOf("]", updatesIndex));
                const updateObjects = parseInstructionFileUpdateString(updatesText);
                registerUpdates = updateObjects.registerUpdates;
                cpsrUpdates = updateObjects.cpsrUpdates;
                spsrUpdates = updateObjects.spsrUpdates;
            }

            return { instruction, registerUpdates, cpsrUpdates, spsrUpdates, lineNumber: i.lineNumber };
        });
}

const mockSetBytesInMemory = (address: number, bytes: Uint8Array, testMemory: Uint8Array) => {
    if (address >= 1000) {
        throw Error(`Address outside bounds of test memory (0-999): ${address}.`);
    }

    for (let i = 0; i < bytes.length; i++) {
        testMemory[address + i] = bytes[i];
    }
}

const mockGetBytesFromMemory = (address: number, bytes: number, testMemory: Uint8Array) => {
    if (address >= 1000) {
        throw Error(`Address outside bounds of test memory (0-999): ${address}.`);
    }

    const result = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
        result[i] = testMemory[address + i];
    }

    return result;
}

/**
 * Creates a map of register names to values, collecting banked registers into a single entry.
 */
const getRegisterSet = (cpu: CPU) => {
    const registers: {[key: string]: number} = {};

    // Registers 0-7 and 15 are fully banked and stored permanently in the current general register list.
    for (let i = 0; i <= 7; i++) {
        registers[`R${i}`] = cpu.currentGeneralRegisters[i];
    }
    registers['R15'] = cpu.currentGeneralRegisters[15];

    // Registers 8-12 are banked for all modes besides FIQ
    if (cpu.operatingMode === OperatingModes.fiq) {
        for (let i = 8; i <= 12; i++) {
            registers[`R${i}_fiq`] = cpu.currentGeneralRegisters[i];
            registers[`R${i}`] = cpu.generalRegisters[0][i];
        }
    } else {
        for (let i = 8; i <= 12; i++) {
            registers[`R${i}_fiq`] = cpu.generalRegisters[OperatingModes.fiq][i];
            registers[`R${i}`] = cpu.currentGeneralRegisters[i];
        }
    }

    [OperatingModes.svc, OperatingModes.abt, OperatingModes.und, OperatingModes.irq, OperatingModes.fiq].forEach(mode => {
        if (cpu.operatingMode === mode) {
            for (let i = 13; i <= 14; i++) {
                registers[`R${i}_${OperatingModeNames[mode]}`] = cpu.currentGeneralRegisters[i];
            }
        } else {
            for (let i = 13; i <= 14; i++) {
                registers[`R${i}_${OperatingModeNames[mode]}`] = cpu.generalRegisters[mode][i];
            }
        }
    });

    if (cpu.operatingMode === OperatingModes.usr || cpu.operatingMode === OperatingModes.sys) {
        for (let i = 13; i <= 14; i++) {
            registers[`R${i}`] = cpu.currentGeneralRegisters[i];
        }
    } else {
        for (let i = 13; i <= 14; i++) {
            registers[`R${i}`] = cpu.generalRegisters[0][i];
        }
    }

    Object.keys(registers).forEach(k => registers[k] = registers[k] >>> 0);
    return registers;
}

const executeInstructionTestFile = (filePath: string, processingFunction: any) => {
    const memory = new Memory();
    const cpu = new CPU(memory);
    cpu.bigEndian = false;
    cpu.reset();

    const testMemory = new Uint8Array(1000);

    jest.spyOn(cpu, "setBytesInMemory").mockImplementation((address, bytes) => mockSetBytesInMemory(address, bytes, testMemory));
    jest.spyOn(cpu, "getBytesFromMemory").mockImplementation((address, bytes) => mockGetBytesFromMemory(address, bytes, testMemory));
    
    const test_cases = getTestCases(filePath);
    test_cases.forEach(t => {
        if (!t.instruction) {
            // Manual register updates
            Object.entries(t.registerUpdates).forEach(([register, value]) => {
                const reg = Number.parseInt(register.substring(1, register.includes("_") ? register.indexOf("_") : register.length));
                cpu.setGeneralRegister(reg, value);
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

            // Manual memory updates
            if (t.memoryUpdates && t.setMemory) {
                Object.entries(t.memoryUpdates).forEach(([address, bytes]) => {
                    cpu.setBytesInMemory(Number.parseInt(address), bytes);
                });
            }

            // Manual memory checks
            if (t.memoryUpdates && t.checkMemory) {
                Object.entries(t.memoryUpdates).forEach(([address, bytes]) => {
                    for (let i = 0; i < bytes.length; i++) {
                        const byteAddress = Number.parseInt(address) + i;
                        expect(
                            testMemory[byteAddress],
                            `Line ${t.lineNumber}: Expected byte at address 0x${byteAddress.toString(16)} to be 0x${bytes[i].toString(16)}, but got 0x${testMemory[byteAddress].toString(16)}.`
                        ).toBe(bytes[i]);
                    }
                });
            }

            return;
        }

        const previousRegisters = getRegisterSet(cpu);
        const previousCPSRFlags = statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('CPSR', f));
        const previousCPSRMode = cpu.getStatusRegister('CPSR') & 0x1F;
        const previousSPSRFlags = cpu.currentModeHasSPSR() ? statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('SPSR', f)) : null;
        const previousSPSRMode = cpu.currentModeHasSPSR() ? cpu.getStatusRegister("SPSR") & 0x1F : null;

        processingFunction(cpu, t.instruction);

        const updatedRegisters = getRegisterSet(cpu);
        const updatedCPSRFlags = statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('CPSR', f));
        const updatedCPSRMode = cpu.getStatusRegister('CPSR') & 0x1F;
        const updatedSPSRFlags = cpu.currentModeHasSPSR() ? statusRegisterFlags.map(f => cpu.getStatusRegisterFlag('SPSR', f)) : null;
        const updatedSPSRMode = cpu.currentModeHasSPSR() ? cpu.getStatusRegister("SPSR") & 0x1F : null;

        const messagePrefix = `Line ${t.lineNumber}: 0x${t.instruction.toString(16)}:`;

        // Check mode specific registers
        Object.keys(previousRegisters).forEach(registerKey => {
            if (registerKey in t.registerUpdates) {
                expect(
                    updatedRegisters[registerKey],
                    `${messagePrefix} Expected ${registerKey} to be updated to 0x${(t.registerUpdates[registerKey] >>> 0).toString(16)}, but was 0x${updatedRegisters[registerKey].toString(16)}.`
                ).toBe(t.registerUpdates[registerKey]);
            } else {
                // No update specified for this register
                expect(
                    updatedRegisters[registerKey],
                    `${messagePrefix} Expected ${registerKey} to be unchanged with value 0x${(previousRegisters[registerKey] >>> 0).toString(16)}, but was 0x${updatedRegisters[registerKey].toString(16)}.`
                ).toBe(previousRegisters[registerKey]);
            }
        });

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
    if (cpu.operatingMode == OperatingModes.usr || cpu.operatingMode === OperatingModes.sys) {
        throw Error(`Cannot access SPSR in operating mode ${cpu.operatingMode}.`);
    }

    let spsr = cpu.getStatusRegister('SPSR');
    const mask = 1 << cpsrBitOffsetMapping[flag];

    if (value === 0) {
        spsr &= ~mask;
    } else {
        spsr |= mask;
    }

    cpu.currentStatusRegisters[1] = spsr;
}

const setSPSRMode = (cpu: CPU, value: number) => {
    if (cpu.operatingMode == OperatingModes.usr || cpu.operatingMode === OperatingModes.sys) {
        throw Error(`Cannot access SPSR in operating mode ${cpu.operatingMode}.`);
    }

    if (Object.values(OperatingModeCodes).includes(value)) {
        cpu.currentStatusRegisters[1] &= ~0x1F;
        cpu.currentStatusRegisters[1] |= value;
    } else {
        throw Error(`Invalid mode bits ${value.toString(2)}`);
    }
}

const executeLoadStoreAddressTestFile = (filePath: string, multipleAddress: boolean) => {
    const memory = new Memory();
    const cpu: CPU = new CPU(memory);
    const rn = 1;

    readFileSync(filePath).toString()
        .split("\r\n")
        .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
        .filter(i => i.line.length > 0 && !i.line.startsWith("#"))
        .forEach(i => {
            const line = i.line;
            if (line.startsWith("SET")) {
                line.substring(4).split(",").map(i => i.trim()).forEach(i => {
                    if (i.toLowerCase().startsWith("r")) {
                        const register = Number.parseInt(i.substring(1, i.indexOf("=")));
                        const value = parseNumericLiteral(i.substring(i.indexOf("=") + 1));
                        expect(register >= 0 && register <= 15).toBeTruthy();
                        cpu.setGeneralRegister(register, value);
                    } else {
                        const flag = i.substring(0, i.indexOf("=")).toLowerCase() as StatusRegisterKey;
                        expect(statusRegisterFlags.includes(flag)).toBeTruthy();
                        const value = parseNumericLiteral(i.substring(i.indexOf("=") + 1));
                        cpu.setStatusRegisterFlag(flag, value);
                    }
                });
            } else {
                const items = line.split(",").map(i => i.trim());
                const instruction = parseNumericLiteral(items[0].substring(12));
                let expectedRnUpdate;
                let previousRnValue;

                if (multipleAddress) {
                    // Addressing mode 4
                    const expectedStartAddress = parseNumericLiteral(items[1].substring(13)) >>> 0;
                    const expectedEndAddress = parseNumericLiteral(items[2].substring(11)) >>> 0;
                    expectedRnUpdate = items.length === 4 ? parseNumericLiteral(items[3].substring(3)) : undefined;

                    previousRnValue = cpu.getGeneralRegister(rn);
                    const [startAddress, endAddress] = getLoadStoreMultipleAddress(cpu, instruction);
                    expect(startAddress, `Line ${i.lineNumber}: Expected start address to be 0x${expectedStartAddress.toString(16)} but got 0x${startAddress.toString(16)}.`).toBe(expectedStartAddress);
                    expect(endAddress, `Line ${i.lineNumber}: Expected end address to be 0x${expectedEndAddress.toString(16)} but got 0x${endAddress.toString(16)}.`).toBe(expectedEndAddress);
                } else {
                    // Addressing modes 2 and 3
                    const expectedAddress = parseNumericLiteral(items[1].substring(8)) >>> 0;
                    expectedRnUpdate = items.length === 3 ? parseNumericLiteral(items[2].substring(3)) : undefined;

                    previousRnValue = cpu.getGeneralRegister(rn);
                    const address = getLoadStoreAddress(cpu, instruction);
                    expect(address, `Line ${i.lineNumber}: Expected address to be 0x${expectedAddress.toString(16)} but got 0x${address.toString(16)}.`).toBe(expectedAddress);
                }

                const rnValue = cpu.getGeneralRegister(rn);
                if (expectedRnUpdate !== undefined) {
                    expect(
                        rnValue,
                        `Line ${i.lineNumber}: Expected R1 to be updated to 0x${expectedRnUpdate.toString(16)} but got 0x${(rnValue >>> 0).toString(16)}.`
                    ).toBe(expectedRnUpdate);
                } else {
                    expect(
                        rnValue,
                        `Line ${i.lineNumber}: Expected R1 to be unchanged from 0x${previousRnValue.toString(16)} but got 0x${(rnValue >>> 0).toString(16)}.`
                    ).toBe(previousRnValue);
                }
            }
        });
}

// Implementation of the display interface for rendering to a file, rather than a Canvas element.
class FileDisplay implements Display {

    currentFrame: number;
    buffers: number[][][];

    constructor() {
        this.currentFrame = 0;
        this.buffers = [
            Array(DisplaySize.width * DisplaySize.height),
            Array(DisplaySize.width * DisplaySize.height)
        ];
        this.reset();
    }

    setFrame(frame: number) {
        this.currentFrame = frame;
    }

    setPixel(x: number, y: number, color: RGBColor) {
        const buffer = this.buffers[this.currentFrame];
        buffer[y * DisplaySize.width + x][0] = color.red;
        buffer[y * DisplaySize.width + x][1] = color.green;
        buffer[y * DisplaySize.width + x][2] = color.blue;
    }

    drawFrame() {}

    saveToFile() : string {
        const buffer = this.buffers[this.currentFrame];
        const bitmap = byteArrayToBitmap(buffer, DisplaySize.width, DisplaySize.height);
        const date = new Date();
        const filename = `./logs/display/gba_display_output_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.bmp`;
        writeFileSync(filename, bitmap);
        return filename;
    }

    reset() {
        for (let frame = 0; frame < 2; frame++) {
            for (let i = 0; i < this.buffers[frame].length; i++) {
                this.buffers[frame][i] = [0, 0, 0];
            }
        }
    }
}

export { executeInstructionTestFile, executeLoadStoreAddressTestFile, FileDisplay };
