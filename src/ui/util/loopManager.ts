const delay: number = 100;
let interval: NodeJS.Timeout;
let running: boolean = false;

const initLoop = () => { running = true; }

const queueTask = (f: any) => {
    if (running) {
        interval = global.setTimeout(f, delay);
    }
}

const killLoop = () => {
    clearInterval(interval);
    running = false;
}

export { initLoop, queueTask, killLoop }
