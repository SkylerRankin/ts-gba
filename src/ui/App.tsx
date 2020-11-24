import React, { Component } from 'react';
import { CPU, CPUType } from '../emulator/cpu';
import { Tabs, Tab, TabPanel, TabList } from 'react-tabs';
import VideoOutput from './components/videoOutput';
import { initLoop, queueTask, killLoop } from './util/loopManager';
import * as cpuWorker from './util/cpu.worker';
import ROMPanel from './components/romPanel';
import CPUPanel from './components/cpuPanel';
import { parseROMBuffer } from '../emulator/romParser';
import './style/app.scss';
import 'react-tabs/style/react-tabs.css';

const worker = (cpuWorker as any)() as typeof cpuWorker;

interface AppState {
    cpu: CPUType,
    romHeader: any,
    romData: Uint8Array
}

class App extends Component<any, AppState> {

    constructor(props:any) {
        super(props);
        this.state = {
            cpu: new CPU(),
            romHeader: null,
            romData: new Uint8Array()
        };
    }

    onRun = () => {
        initLoop();
        const runCPUStep = () => {
            this.state.cpu.step();
            this.forceUpdate();
            if (!this.state.cpu.atBreakpoint()) {
                queueTask(runCPUStep);
            } else {
                // this.setState({running: false});
            }
            
        };
        queueTask(runCPUStep);
        // this.setState({ running: true });
    }

    onROMLoaded = (buffer: any) => {
        const { romHeader } = parseROMBuffer(buffer);
        this.setState({romHeader});
    }

    render() {
        return (
            <div className="app">
                <div className='appContent'>
                    <h1 className="title">
                        <a href='' target='_blank'>ts-gba</a>
                    </h1>
                    <VideoOutput/>
                    <Tabs className="tabSection">
                        <TabList>
                            <Tab>ROM</Tab>
                            <Tab>CPU</Tab>
                            <Tab>GPU</Tab>
                        </TabList>
                        <TabPanel>
                            <ROMPanel onROMLoaded={this.onROMLoaded} data={this.state.romHeader}/>
                        </TabPanel>
                        <TabPanel>
                            <CPUPanel cpu={this.state.cpu}/>
                        </TabPanel>
                        <TabPanel>
                            <h1>Panel 3</h1>
                        </TabPanel>
                    </Tabs>                    
                </div>
            </div>
        )
    }
}

export default App;
