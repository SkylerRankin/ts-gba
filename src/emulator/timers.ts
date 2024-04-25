import { CPU } from "./cpu";
import { Interrupt, requestInterrupt } from "./interrupt";
import { getCachedIORegister } from "./ioCache";

const TimerRegisters = {
    Counter: [
        0x04000100,
        0x04000104,
        0x04000108,
        0x0400010C,
    ],
    Control: [
        0x04000102,
        0x04000106,
        0x0400010A,
        0x0400010E,
    ],
};

const MaxTimer = 3;
const TimerCycleCounts = [ 1, 64, 256, 1024 ];
const InterruptByIndex: Interrupt[] = [ "Timer_0_Overflow", "Timer_1_Overflow", "Timer_2_Overflow", "Timer_3_Overflow" ];

const previousCycleCounts = [0, 0, 0, 0];
const timerReloadValues = [0, 0, 0, 0];
const timerEnabled = [false, false, false, false];

const updateTimers = (cpu: CPU) => {
    let previousOverflowed = false;
    for (let i = 0; i <= MaxTimer; i++) {
        const control = getCachedIORegister(TimerRegisters.Control[i]);
        const enabled = ((control >> 7) & 0x1) === 1;
        const timerNewlyEnabled = enabled && !timerEnabled[i];
        timerEnabled[i] = enabled;

        if (!enabled) {
            continue;
        }

        if (timerNewlyEnabled) {
            // When timer switches from disabled to enabled, the reload value is set.
            cpu.memory.setInt16(TimerRegisters.Counter[i], timerReloadValues[i], true, true);
            previousCycleCounts[i] = cpu.cycles;
            continue;
        }

        const frequency = TimerCycleCounts[control & 0x3];
        const cascade = (control >> 2) & 0x1;
        const raiseInterrupt = (control >> 7) & 0x1;

        let timerIncrease;

        if (cascade) {
            // Timer ignores the frequency controls, and increments whenever the previous timer
            // overflows.
            timerIncrease = previousOverflowed ? 1 : 0;
        } else {
            const elapsed = cpu.cycles - previousCycleCounts[i];
            if (elapsed < frequency) {
                // Not enough cycles have passed to trigger next tick of timer.
                timerIncrease = 0;
            } else {
                const ticks = Math.floor(elapsed / frequency);
                const remaining = elapsed % frequency;
                // TODO: shouldn't this factor in the remaining value
                previousCycleCounts[i] = cpu.cycles;
                timerIncrease = ticks;
            }
        }

        const currentCount = getCachedIORegister(TimerRegisters.Counter[i]);
        let newCount = currentCount + timerIncrease;

        if (newCount >= 0xFFFF) {
            // Timer overflowed, set to the reload value.
            newCount = timerReloadValues[i];
            previousOverflowed = true;
            if (raiseInterrupt) {
                requestInterrupt(cpu, InterruptByIndex[i]);
            }
        } else {
            previousOverflowed = false;
        }

        cpu.memory.setInt16(TimerRegisters.Counter[i], newCount, true, true);
    }
}

const handleTimerCounterWrite16 = (address: number, value: number) : boolean => {
    if (address < TimerRegisters.Counter[0] || address > TimerRegisters.Counter[MaxTimer]) {
        return false;
    }

    for (let i = 0; i <= MaxTimer; i++) {
        if (address === TimerRegisters.Counter[i]) {
            timerReloadValues[i] = value & 0xFFFF;
            return true;
        }
    }

    return false;
}


export { updateTimers, handleTimerCounterWrite16 };
