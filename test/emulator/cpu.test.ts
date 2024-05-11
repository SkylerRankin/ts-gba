import { CPU, OperatingModeCodes, OperatingModes } from "../../src/emulator/cpu";
import { Memory } from "../../src/emulator/memory";


describe("Banked register switching", () => {
    const memory = new Memory();
    const cpu = new CPU(memory);
    
    test("Leave R0-R7, 15 in current register set", () => {
        cpu.reset();
        cpu.setModeBits(OperatingModeCodes.usr);
        for (let i = 0; i <= 7; i++) {
            cpu.setGeneralRegister(i, i);
        }
        cpu.setGeneralRegister(15, 15);

        for (let mode = 0; mode <= 6; mode++) {
            cpu.setModeBits(Object.values(OperatingModeCodes)[mode]);
            for (let i = 0; i <= 7; i++) {
                expect(cpu.getGeneralRegister(i)).toBe(i);
            }
            expect(cpu.getGeneralRegister(15)).toBe(15);
        }
    });

    test("Handle R8 - R12", () => {
        cpu.reset();
        cpu.setModeBits(OperatingModeCodes.usr);

        // Set R8-R12 in user mode
        for (let i = 8; i <= 12; i++) {
            cpu.setGeneralRegister(i, i);
        }

        // Check that user mode values are still present
        for (let i = 8; i <= 12; i++) {
            expect(cpu.getGeneralRegister(i)).toBe(i);
        }

        // Switch to FIQ mode
        cpu.setModeBits(OperatingModeCodes.fiq);
        // Check that user mode values are gone
        for (let i = 8; i <= 12; i++) {
            expect(cpu.getGeneralRegister(i)).toBe(0);
            expect(cpu.generalRegisters[OperatingModes.usr][i]).toBe(i);
        }

        // Set FIQ mode values
        for (let i = 8; i <= 12; i++) {
            cpu.setGeneralRegister(i, i * 2);
        }

        // Switch to system mode
        cpu.setModeBits(OperatingModeCodes.sys);

        // Check that user mode values are restored
        for (let i = 8; i <= 12; i++) {
            expect(cpu.getGeneralRegister(i)).toBe(i);
            expect(cpu.generalRegisters[OperatingModes.fiq][i]).toBe(i * 2);
        }
    });

    test("Handle R13 - R14", () => {
        cpu.reset();
        
        // Set user mode R13-R14
        cpu.setModeBits(OperatingModeCodes.usr);
        cpu.setGeneralRegister(13, 13);
        cpu.setGeneralRegister(14, 14);

        // Switch to system mode and check that register values are unchanged
        cpu.setModeBits(OperatingModeCodes.sys);
        expect(cpu.getGeneralRegister(13)).toBe(13);
        expect(cpu.getGeneralRegister(14)).toBe(14);

        // Switch to supervisor mode and check registers are cleared
        cpu.setModeBits(OperatingModeCodes.svc);
        expect(cpu.getGeneralRegister(13)).toBe(0x03007FE0); // Stack pointer has a special default value
        expect(cpu.getGeneralRegister(14)).toBe(0);
        cpu.setGeneralRegister(13, 13 * 2);
        cpu.setGeneralRegister(14, 14 * 2);

        cpu.setModeBits(OperatingModeCodes.irq);
        expect(cpu.getGeneralRegister(13)).toBe(0x03007FA0);
        expect(cpu.getGeneralRegister(14)).toBe(0);
        cpu.setGeneralRegister(13, 13 * 3);
        cpu.setGeneralRegister(14, 14 * 3);

        cpu.setModeBits(OperatingModeCodes.usr);
        expect(cpu.getGeneralRegister(13)).toBe(13);
        expect(cpu.getGeneralRegister(14)).toBe(14);

        cpu.setModeBits(OperatingModeCodes.svc);
        expect(cpu.getGeneralRegister(13)).toBe(13 * 2);
        expect(cpu.getGeneralRegister(14)).toBe(14 * 2);

        cpu.setModeBits(OperatingModeCodes.irq);
        expect(cpu.getGeneralRegister(13)).toBe(13 * 3);
        expect(cpu.getGeneralRegister(14)).toBe(14 * 3);
    });
});
