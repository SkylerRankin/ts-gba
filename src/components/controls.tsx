import React, { Component } from 'react';
import '../style/controls.scss';

interface ControlsProps {
    running: boolean,
    onRun: () => void,
    onStop: () => void,
    onStep: () => void,
    onReset: () => void,
    onLoadProgram: () => void
}

class Controls extends Component<any, ControlsProps> {
    render() {
        const statusClass = this.props.running ? 'running' : 'stopped';

        return (
            <div className='controls panel'>
                <h1 className='header'>Controls</h1>
                <div className='content'>
                    <div className={`runStatus ${statusClass}`}>
                        {
                            this.props.running ?
                                <div>
                                    <span className='animatedDot'>&#11044;</span>
                                    <span> Running</span>
                                </div>
                            :
                                <span>Stopped</span>
                        }
                    </div>
                    <button onClick={this.props.onRun}>Run</button>
                    <button onClick={this.props.onStop}>Stop</button>
                    <button onClick={this.props.onStep}>Step</button>
                    <button onClick={this.props.onReset}>Reset</button>
                    <button onClick={this.props.onLoadProgram}>Load Program</button>
                </div>
            </div>
        )
    }
}

export default Controls;
