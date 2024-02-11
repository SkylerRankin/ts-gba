
type ProfileMetric = {
    min: bigint;
    max: bigint;
    total: bigint;
    count: bigint;
}


class CPUProfiler {

    instructionTimings: ProfileMetric = {
        min: BigInt(999999999),
        max: BigInt(0),
        total: BigInt(0),
        count: BigInt(0)
    };
    currentInstructionStart: bigint = BigInt(0);

    startInstructionExecution() {
        this.currentInstructionStart = process.hrtime.bigint();
    }

    endInstructionExecution() {
        const elapsed = process.hrtime.bigint() - this.currentInstructionStart;
        if (this.instructionTimings.min > elapsed) this.instructionTimings.min = elapsed;
        if (this.instructionTimings.max < elapsed) this.instructionTimings.max = elapsed;
        this.instructionTimings.total += elapsed;
        this.instructionTimings.count += BigInt(1);
    }

}

export { CPUProfiler }
