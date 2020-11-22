import React, { Component } from 'react';
import '../style/registers.scss';

interface RegistersProps {
    values: number[]
}

class Registers extends Component<any, RegistersProps> {
    
    render() {
        const names : {[key: string] : string} = {
            // '13': 'SP',
            // '14': 'LR',
            // '15': 'PC'
        };

        return (
            <div className='registers panel'>
                <h1 className='header'>Registers</h1>
                <div className='content'>
                    <table>
                        <tbody>
                        {
                            this.props.values.slice(0, Math.ceil(this.props.values.length / 2)).map((value: number, i: number) => {
                                const name = Object.keys(names).includes(i.toString()) ? names[i.toString()] : '';
                                const name2 = Object.keys(names).includes((i + 9).toString()) ? names[(i + 9).toString()] : '';
                                return (
                                    <tr>
                                        <td className='registerName'>{`${i} ${name}`}</td>
                                        <td>0x{value.toString(16).padStart(8, '0')}</td>
                                        { (i + 8 < this.props.values.length) &&  <td className='registerName'>{`${i + 8 + 1} ${name2}`}</td> }
                                        { (i + 8 < this.props.values.length) && <td>0x{this.props.values[i + 8].toString(16).padStart(8, '0')}</td> }
                                    </tr>
                                )
                            })
                        }
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }
}

export default Registers;
