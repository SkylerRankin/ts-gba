
type ProfileMetric = {
    min: number;
    max: number;
    total: number;
    count: number;
}


class CPUProfiler {

    instructionTimings: ProfileMetric = {
        min: 999999999,
        max: 0,
        total: 0,
        count: 0
    };
    currentInstructionStart: number = 0;

    startInstructionExecution() {
        this.currentInstructionStart = performance.now();
    }

    endInstructionExecution() {
        const elapsed = performance.now() - this.currentInstructionStart;
        if (this.instructionTimings.min > elapsed) this.instructionTimings.min = elapsed;
        if (this.instructionTimings.max < elapsed) this.instructionTimings.max = elapsed;
        this.instructionTimings.total += elapsed;
        this.instructionTimings.count += 1;
    }

}

export { CPUProfiler }
