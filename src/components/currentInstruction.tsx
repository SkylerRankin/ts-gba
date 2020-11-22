import React, { Component } from 'react';
import '../style/currentInstruction.scss';

type CurrentInstructionPropType = {
    instruction: number,
    error: string
};

class CurrentInstruction extends Component<CurrentInstructionPropType> {
    render() {
        return (
            <div className='currentInstruction'>
                Current Instruction
                {
                    this.props.error || !this.props.instruction ?
                    <p>{ this.props.error }</p> :
                    <div>
                        <p>0x{this.props.instruction.toString(16)}</p>
                        <p>{this.props.instruction.toString(2).padStart(32, '0')}</p>
                    </div>
                }
            </div>
        )
    }
}

export default CurrentInstruction;
