import React, { Component } from 'react';
import Editor from './components/editor';
import { CPU, CPUType } from './emulator/cpu';
import './style/app.scss';
import Registers from './components/registers';
import AssembledProgram from './components/assembledProgram';
import Controls from './components/controls';
import VideoOutput from './components/videoOutput';
import { initLoop, queueTask, killLoop } from './util/loopManager';

import * as cpuWorker from './util/cpu.worker';
const worker = (cpuWorker as any)() as typeof cpuWorker;

interface AppState {
    cpu: CPUType,
    running: boolean,
    cpuWorker: typeof cpuWorker,
    programText: string[]
}

class App extends Component<any, AppState> {

    constructor(props:any) {
        super(props);
        this.state = {
            cpu: new CPU(),
            running: false,
            cpuWorker: worker,
            programText: []
        };
    }

    onLoadProgramText = (program: string[]) => {
        this.state.cpu.loadProgramFromText(program);
        this.forceUpdate();
    }

    onRun = () => {
        initLoop();
        const runCPUStep = () => {
            this.state.cpu.step();
            this.forceUpdate();
            if (!this.state.cpu.atBreakpoint()) {
                queueTask(runCPUStep);
            } else {
                this.setState({running: false});
            }
            
        };
        queueTask(runCPUStep);
        this.setState({ running: true });
    }

    onStep = () => {
        this.state.cpu.step();
        this.forceUpdate();
    }

    onStop = () => {
        killLoop();
        this.setState({ running: false });
    }

    onReset = () => {
        killLoop();
        this.state.cpu.reset()
        this.forceUpdate();
    }

    onLoadProgram = () => {
        this.state.cpu.loadProgramFromText(this.state.programText);
        this.forceUpdate();
    }

    render() {
        return (
            <div className="app">
                <div className='appContent'>
                    <h1 className="title">ARM Emulator</h1>
                    <Editor
                        setProgramText={(text: string[]) => this.setState({programText: text})}/>
                    {/* <div className="col">
                        <CurrentInstruction error={this.state.selectedInstructionError} instruction={this.state.selectedInstruction}/>
                    </div> */}
                    <AssembledProgram rom={this.state.cpu.rom}/>
                    <Controls
                        running={this.state.running}
                        onRun={this.onRun}
                        onStop={this.onStop}
                        onStep={this.onStep}
                        onReset={this.onReset}
                        onLoadProgram={this.onLoadProgram}
                        />
                    <Registers values={this.state.cpu.generalRegisters}/>
                    <VideoOutput/>
                </div>
            </div>
        )
    }
}

export default App;
