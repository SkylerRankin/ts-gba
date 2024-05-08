import { CPU, Reg } from "./cpu";
import { FlashMemory } from "./flash";
import { handleInterruptAcknowledge8, handleInterruptAcknowledge16 } from "./interrupt";
import { updateIOCache16, updateIOCache32, updateIOCache8 } from "./ioCache";
import { handleTimerCounterWrite16 } from "./timers";

type MemorySegment = 'BIOS' | 'WRAM_O' | 'WRAM_I' | 'IO' | 'PALETTE' | 'VRAM' | 'OAM' | 'ROM_WS0' | 'ROM_WS1' | 'ROM_WS2' | 'SRAM';
type MemoryAccess = { nSeq16: number, seq16: number, nSeq32: number, seq32: number };
type MemoryBackupType = 'Invalid' | 'EEPROM' | 'SRAM' | 'FLASH' | 'FLASH512' | 'FLASH1M';
type MemoryBackup = { type: MemoryBackupType, sizeKB: number, idString: string };
const segmentsByIndex: MemorySegment[] = ['BIOS', 'WRAM_O', 'WRAM_I', 'IO', 'PALETTE', 'VRAM', 'OAM', 'ROM_WS0', 'ROM_WS0', 'ROM_WS1', 'ROM_WS1', 'ROM_WS2', 'ROM_WS2', 'SRAM'];
const segments: {[key in MemorySegment]: {[key in 'start' | 'end']: number}} = {
    BIOS:     { start: 0x00000000, end: 0x00003FFF },
    WRAM_O:   { start: 0x02000000, end: 0x0203FFFF },
    WRAM_I:   { start: 0x03000000, end: 0x03007FFF },
    IO:       { start: 0x04000000, end: 0x040003FE },
    PALETTE:  { start: 0x05000000, end: 0x050003FF },
    VRAM:     { start: 0x06000000, end: 0x06017FFF },
    OAM:      { start: 0x07000000, end: 0x070003FF },
    ROM_WS0:  { start: 0x08000000, end: 0x09FFFFFF },
    ROM_WS1:  { start: 0x0A000000, end: 0x0BFFFFFF },
    ROM_WS2:  { start: 0x0C000000, end: 0x0DFFFFFF },
    SRAM:     { start: 0x0E000000, end: 0x0E00FFFF }
};
const waitStateCycles: {[key in MemorySegment]: MemoryAccess} = {
    BIOS:    { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    WRAM_O:  { nSeq16: 2, seq16: 2, nSeq32: 5, seq32: 5 },
    WRAM_I:  { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    IO:      { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    PALETTE: { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    VRAM:    { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    OAM:     { nSeq16: 0, seq16: 0, nSeq32: 0, seq32: 0 },
    ROM_WS0: { nSeq16: 2, seq16: 2, nSeq32: 4, seq32: 4 },
    ROM_WS1: { nSeq16: 4, seq16: 4, nSeq32: 8, seq32: 8 },
    ROM_WS2: { nSeq16: 4, seq16: 4, nSeq32: 8, seq32: 8 },
    SRAM:    { nSeq16: 4, seq16: 4, nSeq32: 8, seq32: 8 },
};

interface MemoryType {
    memoryBlocks: {[key in MemorySegment]: Uint8Array}
    reset: () => void
    getSegment: (address: number) => MemorySegment
    getBytes: (address: number, bytes: number) => Uint8Array
    getInt8: (address: number) => MemoryReadResult
    getInt16: (address: number) => MemoryReadResult
    getInt32: (address: number) => MemoryReadResult
    loadROM: (rom: Uint8Array) => void
};

interface MemoryReadResult {
    value: number,
    cycles: number
}

type MemoryWriteResult = number;

class Memory implements MemoryType {

    memoryBlocks = {
        'BIOS': new Uint8Array(segments.BIOS.end - segments.BIOS.start + 1),
        'WRAM_O': new Uint8Array(segments.WRAM_O.end - segments.WRAM_O.start + 1),
        'WRAM_I': new Uint8Array(segments.WRAM_I.end - segments.WRAM_I.start + 1),
        'IO': new Uint8Array(segments.IO.end - segments.IO.start + 1),
        'PALETTE': new Uint8Array(segments.PALETTE.end - segments.PALETTE.start + 1),
        'VRAM': new Uint8Array(segments.VRAM.end - segments.VRAM.start + 1),
        'OAM': new Uint8Array(segments.OAM.end - segments.OAM.start + 1),
        'ROM_WS0': new Uint8Array(segments.ROM_WS0.end - segments.ROM_WS0.start + 1),
        'ROM_WS1': new Uint8Array(segments.ROM_WS1.end - segments.ROM_WS1.start + 1),
        'ROM_WS2': new Uint8Array(segments.ROM_WS2.end - segments.ROM_WS2.start + 1),
        'SRAM': new Uint8Array(segments.SRAM.end - segments.SRAM.start + 1),
    };
    cpu: any;
    flashMemory: FlashMemory;
    backup: MemoryBackup;

    constructor() {
        this.flashMemory = new FlashMemory();
        this.reset();
        this.cpu = null;
        this.backup = { type: 'Invalid', sizeKB: 0, idString: "" };
    }

    reset = (): void => {
        for (const block in this.memoryBlocks) {
            this.memoryBlocks[block as MemorySegment].fill(0);
        }
        this.flashMemory.reset();
        this.backup = { type: 'Invalid', sizeKB: 0, idString: "" };
    }

    /**
     * Use bits 28-24 to determine the segment for a given address. This fails to consider accesses that are out
     * of the upper bounds of the segment.
     */
    getSegment = (address: number): MemorySegment => {
        const segmentIndex = Math.max((address >>> 24) - 1, 0);
        return segmentsByIndex[segmentIndex];
    }

    getBytes = (address: number, bytes: number): Uint8Array => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        address = address - segments[segment].start;

        const result = new Uint8Array(bytes);
        for (let i = 0; i < bytes; i++) {
            result[i] = this.memoryBlocks[segment][address + i];
        }
        return result;
    }

    getInt32 = (address: number): MemoryReadResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        if (segment === undefined) {
            return this.getInvalidMemory32();
        } else if (segment === "BIOS" && this.cpu.getGeneralRegister(Reg.PC) - this.cpu.instructionSize * 2 > 0x3FFF) {
            return this.getBIOS32();
        }

        address = address - segments[segment].start;

        let result = 0;
        result |= this.memoryBlocks[segment][address + 0] << (0 * 8);
        result |= this.memoryBlocks[segment][address + 1] << (1 * 8);
        result |= this.memoryBlocks[segment][address + 2] << (2 * 8);
        result |= this.memoryBlocks[segment][address + 3] << (3 * 8);

        return { value: result, cycles: waitStateCycles[segment].nSeq32 };
    }

    getInt16 = (address: number): MemoryReadResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        if (segment === undefined) {
            return this.getInvalidMemory16();
        } else if (segment === "BIOS" && this.cpu.getGeneralRegister(Reg.PC) - this.cpu.instructionSize * 2 > 0x3FFF) {
            return this.getBIOS16();
        }

        address = address - segments[segment].start;
        let result = 0;

        result |= this.memoryBlocks[segment][address + 0] << (0 * 8);
        result |= this.memoryBlocks[segment][address + 1] << (1 * 8);

        return { value: result, cycles: waitStateCycles[segment].nSeq16 };
    }

    getInt8 = (address: number): MemoryReadResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);
        if (segment === undefined) {
            return this.getInvalidMemory8();
        } else if (segment === "BIOS" && this.cpu.getGeneralRegister(Reg.PC) - this.cpu.instructionSize * 2 > 0x3FFF) {
            return this.getBIOS8();
        }

        let result;
        if (segment === "SRAM") {
            result = this.flashMemory.read8(address);
        } else {
            address = address - segments[segment].start;
            result = this.memoryBlocks[segment][address];
        }

        return { value: result, cycles: waitStateCycles[segment].nSeq16 };
    }

    setInt32 = (address: number, value: number, checkForInterruptAck: boolean = true, ioRegisterWrite: boolean = false): MemoryWriteResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);

        // Ignore writes to read only sections
        if (segment === 'BIOS') {
            return 0;
        }

        if (!ioRegisterWrite && this.ignoreWriteAttempt(address)) {
            console.log(`Attempted to write to ${address.toString(16)} without ioRegisterWrite, ignoring attempt.`);
            return 0;
        }

        // TODO: should a 32 bit write handle acknowledging interrupts?

        // TODO: handle writes to timer counter register

        const cachedWrite = updateIOCache32(address, value);

        if (!cachedWrite) {
            const segmentAddress = address - segments[segment].start;
            this.memoryBlocks[segment][segmentAddress + 0] = (value >> 0) & 0xFF;
            this.memoryBlocks[segment][segmentAddress + 1] = (value >> 8) & 0xFF;
            this.memoryBlocks[segment][segmentAddress + 2] = (value >> 16) & 0xFF;
            this.memoryBlocks[segment][segmentAddress + 3] = (value >> 24) & 0xFF;
        }

        return waitStateCycles[segment].nSeq32;
    }

    setInt16 = (address: number, value: number, checkForInterruptAck: boolean = true, ioRegisterWrite: boolean = false): MemoryWriteResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);

        // Ignore writes to read only sections
        if (segment === 'BIOS') {
            return 0;
        }

        if (!ioRegisterWrite && this.ignoreWriteAttempt(address)) {
            console.log(`Attempted to write to ${address.toString(16)} without ioRegisterWrite, ignoring attempt.`);
            return 0;
        }

        // Return early since interrupt acknowledgements don't actual write these
        // bytes to memory.
        if (checkForInterruptAck && handleInterruptAcknowledge16(this.cpu, address, value)) {
            return waitStateCycles[segment].nSeq32;
        }

        // Check if writing to timer counter register, and return early if so since the
        // written value is saved to an internal register, not memory.
        if (!ioRegisterWrite && handleTimerCounterWrite16(address, value)) {
            return waitStateCycles[segment].nSeq16;
        }

        const cachedWrite = updateIOCache16(address, value);

        if (!cachedWrite) {
            const segmentAddress = address - segments[segment].start;
            this.memoryBlocks[segment][segmentAddress + 0] = (value >> 0) & 0xFF;
            this.memoryBlocks[segment][segmentAddress + 1] = (value >> 8) & 0xFF;
        }

        return waitStateCycles[segment].nSeq32;
    }

    setInt8 = (address: number, value: number, checkForInterruptAck: boolean = true, ioRegisterWrite: boolean = false): MemoryWriteResult => {
        address = this.resolveMirroredAddress(address);
        const segment = this.getSegment(address);

        // Ignore writes to read only sections
        if (segment === 'BIOS') {
            return 0;
        }

        if (segment === 'SRAM') {
            this.flashMemory.write8(address, value);
            return waitStateCycles[segment].nSeq32;
        }

        if (!ioRegisterWrite && this.ignoreWriteAttempt(address)) {
            console.log(`Attempted to write to ${address.toString(16)} without ioRegisterWrite, ignoring attempt.`);
            return 0;
        }

        // Return early since interrupt acknowledgements don't actual write these
        // bytes to memory.
        if (checkForInterruptAck && handleInterruptAcknowledge8(this.cpu, address, value)) {
            return waitStateCycles[segment].nSeq32;
        }

        // TODO: handle writes to timer counter register

        const cachedWrite = updateIOCache8(address, value);

        if (!cachedWrite) {
            const segmentAddress = address - segments[segment].start;
            this.memoryBlocks[segment][segmentAddress] = value & 0xFF;
        }

        return waitStateCycles[segment].nSeq32;
    }

    /**
     * If the given address is "mirrored" in memory, the smaller
     * of the equivalent addresses is returned.
     */
    resolveMirroredAddress = (address: number): number => {
        if ((address & 0xFFFFFF00) === 0x03FFFF00) {
            return 0x03007F00 | (address & 0xFF);
        }
        return address;
    }

    ignoreWriteAttempt = (address: number) : boolean => {
        if (address === 0x04000130) {
            return true;
        }
        return false;
    }

    loadROM = (rom: Uint8Array): void => {
        this.memoryBlocks.ROM_WS0.fill(0);
        this.memoryBlocks.ROM_WS1.fill(0);
        this.memoryBlocks.ROM_WS2.fill(0);
        for (let i = 0; i < rom.length; i++) {
            this.memoryBlocks.ROM_WS0[i] = rom[i];
            this.memoryBlocks.ROM_WS1[i] = rom[i];
            this.memoryBlocks.ROM_WS2[i] = rom[i];
        }
        this.loadBackupID();
    }

    loadBIOS = (bios: Uint8Array): void => {
        for (let i = 0; i < bios.length; i++) {
            this.memoryBlocks.BIOS[i] = bios[i];
        }
    }

    get16BitSeqWaitCycles = (address: number): number => {
        return 1 + waitStateCycles[this.getSegment(address)].seq16;
    }

    get16BitNonSeqWaitCycles = (address: number): number => {
        return 1 + waitStateCycles[this.getSegment(address)].nSeq16;
    }

    get32BitSeqWaitCycles = (address: number): number => {
        return 1 + waitStateCycles[this.getSegment(address)].seq32;
    }

    get32BitNonSeqWaitCycles = (address: number): number => {
        return 1 + waitStateCycles[this.getSegment(address)].nSeq32;
    }

    /**
     * Instructions that attempt to read from unused memory locations will get the most
     * recently pre-fetched instruction as the read value.
     */
    getInvalidMemory32 = () : MemoryReadResult => {
        const cpu = (this.cpu as CPU);
        const pc = cpu.getGeneralRegister(Reg.PC);
        let value = 0;
        if (cpu.operatingState === "ARM") {
            value = this.getInt32(pc).value;
        } else {
            const segment = this.getSegment(pc);
            switch (segment) {
                case "WRAM_O":
                case "PALETTE":
                case "VRAM":
                case "ROM_WS0":
                case "ROM_WS1":
                case "ROM_WS2":
                    value = (this.getInt16(pc).value << 16) | this.getInt16(pc).value;
                    break;
                case "BIOS":
                case "OAM":
                    if ((pc & 0x3) === 0) {
                        // 4 byte aligned address
                        value = (this.getInt16(pc + 2).value << 16) | this.getInt16(pc).value;
                    } else {
                        value = (this.getInt16(pc).value << 16) | this.getInt16(pc - 2).value;
                    }
                    break;
                case "WRAM_I":
                    if ((pc & 0x3) === 0) {
                        // 4 byte aligned address
                        value = (this.getInt16(pc - 2).value << 16) | this.getInt16(pc).value;
                    } else {
                        value = (this.getInt16(pc).value << 16) | this.getInt16(pc - 2).value;
                    }
                    break;
                default:
                    throw Error(`Program executing in unexpected segment ${segment}.`);
            }
        }
        return { value: value, cycles: this.get32BitNonSeqWaitCycles(pc) };
    }

    getInvalidMemory16 = () : MemoryReadResult => {
        const {value, cycles} = this.getInvalidMemory32();
        return { value: value & 0xFFFF, cycles };
    }

    getInvalidMemory8 = () : MemoryReadResult => {
        const {value, cycles} = this.getInvalidMemory32();
        return { value: value & 0xFF, cycles };
    }

    /**
     * Reads to the BIOS segment are restricted to only instructions that are executing
     * within the BIOS. Other instructions will receive the last fetched instruction in
     * the BIOS segment.
     */
    getBIOS32 = () : MemoryReadResult => {
        const pc = this.cpu.lastBIOSPC;
        const address = pc - segments["BIOS"].start;
        let value = 0;
        value |= this.memoryBlocks["BIOS"][address + 0] << (0 * 8);
        value |= this.memoryBlocks["BIOS"][address + 1] << (1 * 8);
        value |= this.memoryBlocks["BIOS"][address + 2] << (2 * 8);
        value |= this.memoryBlocks["BIOS"][address + 3] << (3 * 8);
        return { value: value, cycles: this.get32BitNonSeqWaitCycles(pc) }
    }

    getBIOS16 = () : MemoryReadResult => {
        const pc = this.cpu.lastBIOSPC;
        const address = pc - segments["BIOS"].start;
        let value = 0;
        value |= this.memoryBlocks["BIOS"][address + 0] << (0 * 8);
        value |= this.memoryBlocks["BIOS"][address + 1] << (1 * 8);
        return { value: value & 0xFFFF, cycles: this.get32BitNonSeqWaitCycles(pc) }
    }

    getBIOS8 = () : MemoryReadResult => {
        const pc = this.cpu.lastBIOSPC;
        const address = pc - segments["BIOS"].start;
        const value = this.memoryBlocks["BIOS"][address];
        return { value: value & 0xFF, cycles: this.get32BitNonSeqWaitCycles(pc) }
    }

    /**
     * The cartridge backup ID is stored as a word aligned ASCII string somewhere in the ROM
     * memory segment. The string is a multiple of 4 bytes and zero padded.
     */
    loadBackupID = () : void => {
        const validIDs = [
            "EEPROM_V",
            "SRAM_V",
            "FLASH_V",
            "FLASH512_V",
            "FLASH1M_V",
        ];

        let currentID = "";
        let i = 0;
        for (; i < this.memoryBlocks["ROM_WS0"].length; i++) {
            const character = String.fromCharCode(this.memoryBlocks["ROM_WS0"][i]);
            let foundMatch = false;
            let foundPrefix = false;
            for (let j = 0; j < validIDs.length; j++) {
                if (validIDs[j] === currentID + character) {
                    foundMatch = true;
                    break;
                } else if (validIDs[j].startsWith(currentID + character)) {
                    foundPrefix = true;
                    break;
                }
            }

            if (foundMatch) {
                currentID = currentID + character;
                break;
            } else if (foundPrefix) {
                currentID = currentID + character;
            } else {
                currentID = character;
            }
        }

        switch (currentID) {
            case "EEPROM_V":
                this.backup.type = "EEPROM";
                this.backup.sizeKB = 8;
                break;
            case "SRAM_V":
                this.backup.type = "SRAM";
                this.backup.sizeKB = 32;
                break;
            case "FLASH_V":
            case "FLASH512_V":
                this.backup.type = "FLASH";
                this.backup.sizeKB = 64;
                break;
            case "FLASH1M_V":
                this.backup.type = "FLASH";
                this.backup.sizeKB = 128;
                break;
            default:
                this.backup.type = "Invalid";
                this.backup.sizeKB = 0;
        }

        // The three characters after id are version numbers.
        if (validIDs.includes(currentID)) {
            for (let j = 1; j <= 3; j++) {
                currentID += String.fromCharCode(this.memoryBlocks["ROM_WS0"][i + j]);
            }
            this.backup.idString = currentID;
        }

        if (this.backup.type !== "FLASH" && this.backup.sizeKB !== 128) {
            throw Error(`Unsupported backup chip: ${this.backup.idString}. Only 128 KB Flash storage is implemented.`);
        }
    }

}

export { Memory, segments as MemorySegments, MemorySegment }
