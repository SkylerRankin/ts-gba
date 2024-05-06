const CommandBytes = {
    Prefix1: 0xAA,
    Prefix2: 0x55,
    EnterChipID: 0x90,
    ExitChipID: 0xF0,
    WriteByte: 0xA0,
    Erase: 0x80,
    EraseAll: 0x10,
    EraseSector: 0x30,
    BankSwitch: 0xB0,
};

const Command = {
    None: 0,        // Before any command has started
    Prefix1: 1,     // First prefix byte was written
    Prefix2: 2,     // Second prefix byte was written, directly after first.
    ID: 3,
    WriteByte: 4,
    Erase: 5,
    EraseAll: 6,
    EraseSector: 7,
    BankSwitch: 8,
};

const SRAMAddress = {
    A: 0x0E005555,
    B: 0x0E002AAA,
    ChipIdDev: 0x0E000001,
    ChipIdMan: 0x0E000000,
};

// TODO: support other chips, such as a 64k variant
const ChipID = {
    device: 0x09,
    manufacturer: 0xC2,
}


class FlashMemory {
    currentState = Command.None;
    previousCommand = Command.None;
    currentBank = 0;
    memory = [
        new Uint8Array(65536),
        new Uint8Array(65536),
    ];

    write8(address: number, value: number) : boolean {
        if (address >>> 16 !== 0x0E00) {
            return false;
        }

        if (this.previousCommand === Command.WriteByte) {
            this.memory[this.currentBank][address & 0xFFFF] = value;
            this.previousCommand = Command.None;
        } else if (address === 0x0E005555) {
            switch (this.currentState) {
                case Command.None:
                    if (value === CommandBytes.Prefix1) {
                        this.currentState = Command.Prefix1;
                    } else {
                        this.currentState = Command.None;
                    }
                    break;
                case Command.Prefix1:
                    if (value !== CommandBytes.Prefix1) {
                        this.currentState = Command.None;
                    }
                    break;
                case Command.Prefix2:
                    this.executeCommand(address, value);
                    break;
            }
        } else if (address === 0x0E002AAA) {
            switch (this.currentState) {
                case Command.Prefix1:
                    if (value === CommandBytes.Prefix2) {
                        this.currentState = Command.Prefix2;
                    } else {
                        this.currentState = Command.None;
                    }
                    break;
            }
        } else if (this.previousCommand === Command.Erase && (address & 0xFFFF0FFF) === 0x0E000000) {
            this.executeCommand(address, value);
        } else if (this.previousCommand === Command.BankSwitch && address === 0x0E000000) {
            this.previousCommand = Command.None;
            this.currentState = Command.None;
            this.currentBank = value & 0x1;
        } else {
            if (this.currentState === Command.WriteByte) {
                this.memory[this.currentBank][address & 0xFFFF] = value;
            } else {
                throw Error(`Attempted to write byte in SRAM without corresponding write command.` +
                    `[${address.toString(16)}] = ${value.toString()}.`);
            }
        }

        return true;
    }

    read8(address: number) : number {
        switch (this.previousCommand) {
            case Command.ID:
                if (address === SRAMAddress.ChipIdDev) {
                    return ChipID.device;
                } else if (address === SRAMAddress.ChipIdMan) {
                    return ChipID.manufacturer;
                } else {
                    return this.memory[this.currentBank][address & 0xFFFF];
                }
            default:
                return this.memory[this.currentBank][address & 0xFFFF];
        }
    }

    reset() {
        this.currentState = Command.None;
        this.previousCommand = Command.None;
        this.currentBank = 0;
        this.memory[0].fill(0xFF);
        this.memory[1].fill(0xFF);
    }

    executeCommand(address: number, value: number) {
        switch (value) {
            case CommandBytes.EnterChipID:
                this.currentState = Command.None;
                this.previousCommand = Command.ID;
                break;
            case CommandBytes.ExitChipID:
                this.currentState = Command.None;
                this.previousCommand = Command.None;
                break;
            case CommandBytes.Erase:
                this.previousCommand = Command.Erase;
                this.currentState = Command.None;
                break;
            case CommandBytes.EraseSector:
                // Address is 0x0E00n000, where n is the 4k sector index.
                for (let i = address & 0xFFFF; i < (address & 0xFFFF) + 0x1000; i++) {
                    this.memory[this.currentBank][i] = 0xFF;
                }
                this.previousCommand = Command.None;
                this.currentState = Command.None;
                break;
            case CommandBytes.EraseAll:
                if (this.previousCommand === Command.Erase) {
                    for (let bank = 0; bank <= 1; bank++) {
                        this.memory[bank].fill(0xFF);
                        this.memory[bank].fill(0xFF);
                    }
                    this.previousCommand = Command.None;
                    this.currentState = Command.None;
                }
                break;
            case CommandBytes.WriteByte:
                this.previousCommand = Command.WriteByte;
                this.currentState = Command.None;
                break;
            case CommandBytes.BankSwitch:
                this.previousCommand = Command.BankSwitch;
                this.currentState = Command.None;
                break;
        }
    }
}


export { FlashMemory };
