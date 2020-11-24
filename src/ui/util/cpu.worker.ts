import { CPU } from '../../emulator/cpu';

const cpu = new CPU();
console.log('CPU Worker Initialized...', cpu);
let running: boolean = false;

export function run() {
    console.log('cpu.worker.run()');
    running = true;
    let i = 0;
    while (running) {
        i++;
        if (i % 1000) console.log('1000 iterations have passed');
        i = i % 1000;
    }
}

export function stop() {
    console.log('cpu.worker.stop()');
    running = false;
}
