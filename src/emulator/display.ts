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
    drawFrame: () => void;
    reset: () => void;
}

class CanvasDisplay implements Display {

    // TODO: is this dual canvas approach efficient for handling the two frames?
    currentContext: number;
    imageData: ImageData[];
    canvases: HTMLCanvasElement[];
    intermediateCanvases: HTMLCanvasElement[];
    contexts: CanvasRenderingContext2D[];

    constructor() {
        this.canvases = [
            document.getElementById("frame_0_canvas") as HTMLCanvasElement,
            document.getElementById("frame_1_canvas") as HTMLCanvasElement
        ];
        this.intermediateCanvases = [];
        for (let i = 0; i < 2; i++) {
            const c = document.createElement("canvas") as HTMLCanvasElement;
            c.setAttribute("width", `${DisplaySize.width}`);
            c.setAttribute("height", `${DisplaySize.height}`);
            c.style.imageRendering = "pixelated";
            this.intermediateCanvases.push(c);
        }
        this.contexts = [
            this.canvases[0]?.getContext("2d") as CanvasRenderingContext2D,
            this.canvases[1]?.getContext("2d") as CanvasRenderingContext2D
        ];
        this.imageData = [
            this.contexts[0].createImageData(DisplaySize.width, DisplaySize.height),
            this.contexts[1].createImageData(DisplaySize.width, DisplaySize.height),
        ];
        
        this.currentContext = 0;
    }

    setPixel(x: number, y: number, color: RGBColor) {
        const baseIndex = (y * DisplaySize.width + x) * 4;
        this.imageData[this.currentContext].data[baseIndex + 0] = Math.floor(color.red);
        this.imageData[this.currentContext].data[baseIndex + 1] = Math.floor(color.green);
        this.imageData[this.currentContext].data[baseIndex + 2] = Math.floor(color.blue);
        this.imageData[this.currentContext].data[baseIndex + 3] = 255;
    }

    drawFrame() {
        this.intermediateCanvases[this.currentContext].getContext("2d")?.putImageData(this.imageData[this.currentContext], 0, 0);
        this.canvases[this.currentContext].getContext("2d")?.drawImage(this.intermediateCanvases[this.currentContext] as any, 0, 0, DisplaySize.width * CanvasScaling, DisplaySize.height * CanvasScaling);
    }

    setFrame(frame: number) {
        if (frame === 0) {
            this.canvases[0].classList.remove("hidden");
            this.canvases[1].classList.add("hidden");
        } else {
            this.canvases[1].classList.remove("hidden");
            this.canvases[0].classList.add("hidden");
        }

        this.currentContext = frame;
    }

    reset() {
        for (let i = 0; i < 2; i++) {
            this.contexts[i].fillStyle = "#ededed";
            this.contexts[i].fillRect(0, 0, DisplaySize.width * CanvasScaling, DisplaySize.height * CanvasScaling);
        }
        this.currentContext = 0;
    }

}

export { CanvasDisplay, Display, DisplaySize };
export type { RGBColor };
