import React, { Component } from 'react';
import { EditorBlock } from 'draft-js';

interface EditorLineProps {
    block: any,
    contentState: any
}

class EditorLine extends Component<EditorLineProps> {
    render() {
        const {block, contentState} = this.props;
        // const {foo} = this.props.blockProps;
        // const data = contentState.getEntity(block.getEntityAt(0)).getData();
        const blockKey: string = block.key;
        const blockMap = contentState.getBlockMap().toArray();
        const lineNumber = blockMap.findIndex((block: any) => blockKey === block.key) + 1;
        return (
            <span className="editorLine">
                <span className="lineNumber" contentEditable={false}>{ lineNumber }</span>
                <div className="lineContent">
                    <EditorBlock {...this.props}/>
                </div>
            </span>
        )
    }
}

export default EditorLine;
