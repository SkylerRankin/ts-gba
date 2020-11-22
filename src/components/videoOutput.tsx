import React, { Component, createRef } from 'react';
import '../style/videoOutput.scss';

type VideoOutputProps = {}

type VideoOutputState = {
    ctx: CanvasRenderingContext2D | undefined,
    width: number,
    height: number
}

class VideoOutput extends Component<VideoOutputProps, VideoOutputState> {

    private canvasRef = createRef<HTMLCanvasElement>();

    constructor(props: any) {
        super(props);
        this.state = {
            ctx: undefined,
            width: 256,
            height: 128
        };
    }

    componentDidMount() {
        const ctx = this.canvasRef.current?.getContext('2d');
        if (!ctx) return;
        for (let x = 0; x < this.state.width; x++) {
            for (let y = 0; y < this.state.height; y++) {
                ctx.fillStyle = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    render() {
        return (
            <div className='panel videoOutput'>
                <h1 className='header'>Video Output</h1>
                <canvas ref={this.canvasRef} width={this.state.width} height={this.state.height}/>
            </div>
        )
    }
}

export default VideoOutput;
