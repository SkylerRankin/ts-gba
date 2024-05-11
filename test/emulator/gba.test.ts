import { readFileSync, rmSync } from "fs";
import { GBA } from "../../src/emulator/gba";
import { compareBitmaps } from "../../src/emulator/image";
import { FileDisplay } from "./test_utilities";


// Tests that run a test rom for a specified number of frames, and compare the
// display at that frame to a reference bitmap image.
// TODO: These tests should not be taking multiple frames to render
const romFrameTests = [
    {
        name: "three_squares",
        romPath: "test/emulator/data/roms/three_squares.gba",
        frameChecks: [
            {
                frame: 6,
                path: "test/emulator/data/frames/three_squares.bmp"
            }
        ]
    },
    {
        name: "mode_3_lines",
        romPath: "test/emulator/data/roms/mode_3_lines.gba",
        frameChecks: [
            {
                frame: 10,
                path: "test/emulator/data/frames/mode_3_lines.bmp"
            }
        ]
    },
    {
        name: "mode_4_page_flip",
        romPath: "test/emulator/data/roms/mode_4_page_flip.gba",
        frameChecks: [
            {
                frame: 8,
                path: "test/emulator/data/frames/mode_4_page_front.bmp"
            },
            {
                frame: 9,
                path: "test/emulator/data/frames/mode_4_page_back.bmp"
            }
        ]
    },
    {
        name: "bitmap_mode_switch",
        romPath: "test/emulator/data/roms/bitmap_mode_switch.gba",
        frameChecks: [
            {
                frame: 6,
                path: "test/emulator/data/frames/mode_3_data.bmp"
            },
            {
                frame: 7,
                path: "test/emulator/data/frames/mode_4_data.bmp"
            },
            {
                frame: 8,
                path: "test/emulator/data/frames/mode_5_data.bmp"
            }
        ]
    }
];

const assertCurrentDisplayValue = (gba: GBA, expectedFramePath: string) => {
    const path = (gba.display as FileDisplay).saveToFile();
    const actualImage = new Uint8Array(readFileSync(path));
    const expectedImage = new Uint8Array(readFileSync(expectedFramePath));
    const result = compareBitmaps(actualImage, expectedImage);
    expect(result.equal, result.message).toBeTruthy();
    rmSync(path);
}

describe("Test ROM output display checks", () => {
    romFrameTests.forEach(config => {
        test(config.name, () => {
            const gba = new GBA(new FileDisplay());
            gba.ppu.display = gba.display;
            gba.reset(false);

            const maxFrames = config.frameChecks[config.frameChecks.length - 1].frame;
            const rom = new Uint8Array(readFileSync(config.romPath));
            gba.loadROM(rom);
            gba.status = "paused";
            let nextFrameCheck = 0;
            for (let i = 0; i < maxFrames; i++) {
                gba.runFrame();
                if (nextFrameCheck < config.frameChecks.length && i === config.frameChecks[nextFrameCheck].frame - 1) {
                    assertCurrentDisplayValue(gba, config.frameChecks[nextFrameCheck].path);
                    nextFrameCheck++;
                }
            }
        });
    });
});
