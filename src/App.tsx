import React, { Component } from 'react';
import Editor from './components/editor';
import { CPU, CPUType } from './emulator/cpu';
import './style/app.scss';

interface AppState {
    cpu: CPUType
}

class App extends Component<AppState, any> {

    constructor(props:any) {
        super(props);
        this.state = {
            cpu: new CPU()
        };
    }

    onLoadProgramText = (program: string[]) => {
        this.state.cpu.loadProgramFromText(program);
    }

    render() {
        return (
            <div className="app">
                <div className="container">
                    <h1 className="title">ARM Emulator</h1>
                    <Editor onLoadProgram={this.onLoadProgramText}/>
                </div>
            </div>
        )
    }
}

export default App;
