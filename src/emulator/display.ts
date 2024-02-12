type RGBColor = {
    red: number,
    green: number,
    blue: number
}

const DisplaySize = {
    width: 240,
    height: 160
};

const CanvasScaling = 2;

interface Display {
    setPixel: (x: number, y: number, color: RGBColor) => void;
    setFrame: (frame: number) => void;
    reset: () => void;
}

class CanvasDisplay implements Display {

    // TODO: is this dual canvas approach efficient for handling the two frames?
    currentContext: number;
    canvases: HTMLCanvasElement[];
    contexts: CanvasRenderingContext2D[];

    constructor() {
        this.canvases = [
            document.getElementById("frame_0_canvas") as HTMLCanvasElement,
            document.getElementById("frame_1_canvas") as HTMLCanvasElement
        ];
        this.contexts = [
            this.canvases[0]?.getContext("2d") as CanvasRenderingContext2D,
            this.canvases[1]?.getContext("2d") as CanvasRenderingContext2D
        ];

        for (let i = 0; i < 2; i++) {
            this.contexts[i]?.scale(CanvasScaling, CanvasScaling);
        }
        
        this.currentContext = 0;
    }

    setPixel(x: number, y: number, color: RGBColor) {
        const context = this.contexts[this.currentContext];
        // TODO: batch these draw calls and write once with putImageData
        context.fillStyle = `rgb(${color.red}, ${color.green}, ${color.blue})`;
        context.fillRect(x, y, 1, 1);
    }

    setFrame(frame: number) {
        if (frame === 0) {
            this.canvases[0].classList.remove("canvas_hidden");
            this.canvases[1].classList.add("canvas_hidden");
        } else {
            this.canvases[1].classList.remove("canvas_hidden");
            this.canvases[0].classList.add("canvas_hidden");
        }

        this.currentContext = frame;
    }

    reset() {
        for (let i = 0; i < 2; i++) {
            this.contexts[i].fillStyle = "#ededed";
            this.contexts[i].fillRect(0, 0, DisplaySize.width, DisplaySize.height);
        }
        this.currentContext = 0;
    }

}

export { CanvasDisplay, Display, DisplaySize };
export type { RGBColor };
