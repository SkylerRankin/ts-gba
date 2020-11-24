import React, { Component } from 'react';
import '../style/romPanel.scss';

interface ROMPanelState {
    romData: any
}

interface ROMPanelProps {
    onROMLoaded: (buffer: any) => void,
    data: any
}

class ROMPanel extends Component<ROMPanelProps, ROMPanelState> {

    constructor(props: any) {
        super(props);
        this.state = {
            romData: null
        };
    }

    onFileSelected = (event: any) => {
        if (event.target.files && event.target.files[0]) {
            const fileReader = new FileReader();
            fileReader.onloadend = (event) => {
                if (fileReader.result !== null) {
                    this.props.onROMLoaded(fileReader.result);
                }
            }
            fileReader.readAsArrayBuffer(event.target.files[0]);
        }
    }

    render() {
        let content = <p>No ROM loaded.</p>
        if (this.props.data !== null) {
            content = <div>
                <h3>{this.props.data.gameTitle}</h3>
                <table>
                    <tbody>
                        <tr>
                            <td>ROM Size</td>
                            <td>{`${Math.floor(this.props.data.fileSize / 1000 / 1000)}kb`}</td>
                        </tr>
                        <tr>
                            <td>Entry Instruction</td>
                            <td>0x{this.props.data.romEntry.toString(16).padStart(8, '0')}</td>
                        </tr>
                        <tr>
                            <td>Game Code</td>
                            <td>{this.props.data.gameCode}</td>
                        </tr>
                        <tr>
                            <td>Maker Code</td>
                            <td>{this.props.data.makerCode}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        }

        return (
            <div className='romPanel'>
                <input id='romInput' type='file' onChange={this.onFileSelected}/>
                <button id='uploadButton' onClick={() => document.getElementById('romInput')?.click()}>Upload</button>
                { content }
            </div>
        )
        
    }
}

export default ROMPanel;
