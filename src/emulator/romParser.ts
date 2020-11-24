const parseROMBuffer = (buffer: any) => {
    const headerBuffer: Uint8Array = new Uint8Array(buffer.slice(0, 192));
    const rom: Uint8Array = new Uint8Array(buffer.slice(192));
    let header = parseHeader(headerBuffer, rom.length);
    return {romHeader: header};
}

const parseHeader = (buffer: Uint8Array, fileSize: number) => {
    const textDecoder = new TextDecoder();
    const romEntry = new DataView(buffer.slice(0x0, 0x4).buffer).getUint32(0);
    const logo = buffer.slice(0x4, 0xA0);
    const gameTitle = textDecoder.decode(buffer.slice(0xA0, 0xAC));
    const gameCode = textDecoder.decode(buffer.slice(0xAC, 0xB0));
    const makerCode = textDecoder.decode(buffer.slice(0xB0, 0xB2));
    return { romEntry, logo, gameTitle, gameCode, makerCode, fileSize };
}

export { parseROMBuffer }
