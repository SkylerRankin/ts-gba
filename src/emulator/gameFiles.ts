import { GBA, ROMInfo } from "./gba";
import { Memory } from "./memory";

/**
 * Parses the currently loaded cartridge header.
 */
const parseROMInfo = (gba: GBA) : ROMInfo => {
    const rom = gba.memory.memoryBlocks["ROM_WS0"];
    const entryPoint =
       ((rom[0] << 0) |
        (rom[1] << 8) |
        (rom[2] << 16) |
        (rom[3] << 24)) >>> 0;

    let title = "";
    for (let i = 0xA0; i < 0xAC; i++) {
        title += String.fromCharCode(rom[i]);
    }

    let gameCode = "";
    for (let i = 0xAC; i < 0xB0; i++) {
        gameCode += String.fromCharCode(rom[i]);
    }

    let makerCode = "";
    for (let i = 0xB0; i < 0xB2; i++) {
        makerCode += String.fromCharCode(rom[i]);
    }

    const checksum = rom[0xBD];

    return {
        title,
        code: gameCode,
        maker: makerCode,
        entryPoint,
        checksum,
    };
}

const parseBIOSInfo = (gba: GBA) : any => {
    const bios = gba.memory.memoryBlocks["BIOS"];
    let checksum = 0;
    for (let i = 0; i < bios.length; i+=4) {
        const int32 =
            (bios[i + 0] << 0) |
            (bios[i + 1] << 8) |
            (bios[i + 2] << 16) |
            (bios[i + 3] << 24);
            checksum += int32;
    }
    checksum >>>= 0;

    let type = "Unrecognized BIOS file";
    switch (checksum) {
        case 0xBAAE187F:
            type = "Official Nintendo BIOS"
            break;
        case 0x4A2228F:
            type = "Normmatt Open Source BIOS";
            break;
    }

    return { checksum, type };
}

/**
 * Updates the backup object in the provided memory object.
 * The cartridge backup ID is stored as a word aligned ASCII string somewhere in the ROM
 * memory segment. The string is a multiple of 4 bytes and zero padded.
 */
const setBackupID = (memory: Memory) : void => {
    const validIDs = [
        "EEPROM_V",
        "SRAM_V",
        "FLASH_V",
        "FLASH512_V",
        "FLASH1M_V",
    ];

    let currentID = "";
    let i = 0;
    for (; i < memory.memoryBlocks["ROM_WS0"].length; i++) {
        const character = String.fromCharCode(memory.memoryBlocks["ROM_WS0"][i]);
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
            memory.backup.type = "EEPROM";
            memory.backup.sizeKB = 8;
            break;
        case "SRAM_V":
            memory.backup.type = "SRAM";
            memory.backup.sizeKB = 32;
            break;
        case "FLASH_V":
        case "FLASH512_V":
            memory.backup.type = "FLASH";
            memory.backup.sizeKB = 64;
            break;
        case "FLASH1M_V":
            memory.backup.type = "FLASH";
            memory.backup.sizeKB = 128;
            break;
        default:
            memory.backup.type = "Invalid";
            memory.backup.sizeKB = 0;
    }

    // The three characters after id are version numbers.
    if (validIDs.includes(currentID)) {
        for (let j = 1; j <= 3; j++) {
            currentID += String.fromCharCode(memory.memoryBlocks["ROM_WS0"][i + j]);
        }
        memory.backup.idString = currentID;

        if (memory.backup.type !== "FLASH" && memory.backup.sizeKB !== 128) {
            throw Error(`Unsupported backup chip: ${memory.backup.idString}. Only 128 KB Flash storage is implemented.`);
        }
    } else {
        console.error("Loaded ROM does not contain any recognized backup storage string.");
    }
}

export { parseROMInfo, parseBIOSInfo, setBackupID };
