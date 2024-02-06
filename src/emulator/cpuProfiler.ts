
type ProfileMetric = {
    min: number;
    max: number;
    total: number;
    count: number;
}


class CPUProfiler {

    instructionTimings: ProfileMetric = {
        min: 99999999,
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
        this.instructionTimings.min = Math.min(this.instructionTimings.min, elapsed);
        this.instructionTimings.max = Math.max(this.instructionTimings.min, elapsed);
        this.instructionTimings.total += elapsed;
        this.instructionTimings.count += 1;
    }

}

export { CPUProfiler }
