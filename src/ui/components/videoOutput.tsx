import React, { Component, createRef } from 'react';

type VideoOutputProps = {}

type VideoOutputState = {
    ctx: CanvasRenderingContext2D | undefined
}

class VideoOutput extends Component<VideoOutputProps, VideoOutputState> {

    private canvasRef = createRef<HTMLCanvasElement>();
    private ctx: CanvasRenderingContext2D | undefined;
    private canvas: HTMLCanvasElement | null = null;

    constructor(props: any) {
        super(props);
        this.state = {
            ctx: undefined
        };
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current?.getContext('2d') || undefined;
        this.canvas = this.canvasRef.current;
        this.resizeCanvasToDisplay();
        if (!this.ctx || !this.canvas) return;
        let w = this.canvas.width;
        let h = this.canvas.height;
        this.ctx.imageSmoothingEnabled = false;

        let s = 1;

        s = 20;
        this.ctx.fillStyle = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
        this.ctx.fillRect(0, 0, s, s);

        this.ctx.fillStyle = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
        this.ctx.fillRect(w - s, h - s, s, s);

        window.addEventListener('resize', () => {
            this.resizeCanvasToDisplay();
        });
    }

    resizeCanvasToDisplay = () => {
        if (!this.canvas) return;
        const { width, height } = this.canvas.getBoundingClientRect();
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    render() {
        const w = this.ctx?.canvas.width;
        const h = this.ctx?.canvas.height;
        return (
            <div className='displaySection'>
                <canvas id='canvas' width={w} height={h} ref={this.canvasRef}/>
                <p>Controls</p>
            </div>
        )
    }
}

export default VideoOutput;
