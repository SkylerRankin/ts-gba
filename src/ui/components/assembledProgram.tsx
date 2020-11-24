import React, { Component } from 'react';
import '../style/assembledProgram.scss';

interface AssembledProgramProps {
    rom: number[]
};

class AssembledProgram extends Component<AssembledProgramProps, any> {

    constructor(props: any) {
        super(props);
    }

    render() {
        let rows : any = [];
        for (let i = 0; i < 1000; i++) {
            const instruction = this.props.rom.length > i ? this.props.rom[i] : 0;
            rows.push(
                <tr>
                    <td className='address'>0x{(instruction).toString(16).padStart(8, '0')}</td>
                    <td className='instruction'>NOP</td>
                </tr>
            );
        }

        return (
            <div className='assembledProgram panel'>
                <h1 className='header'>Program Memory</h1>
                <div className='content'>
                    <table>
                        { rows }
                    </table>
                </div>
            </div>
        )
    }
}

export default AssembledProgram;
