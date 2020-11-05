import React, { Component } from 'react';
import {Editor as DraftEditor, EditorState as DraftEditorState, ContentState} from 'draft-js';
import EditorLine from './editorLine';
import '../style/editor.scss';

interface EditorProps {
    onLoadProgram: (p: string[]) => any
}

interface EditorState {
    editorState: DraftEditorState
}

const preloadedStates = {
    'test': ['ADD R0, R1, R2', 'ADDS R1, R2, #23', 'ADDEQS R3, R4, #0x101', 'ADD R0, R1, R2, LSL #3'].join('\n')
};

class Editor extends Component<EditorProps, EditorState> {

    constructor(props: EditorProps) {
        super(props);
        this.state = {
            editorState: DraftEditorState.createWithContent(ContentState.createFromText(preloadedStates.test))
        };
    }

    onEditorChange = (newState: DraftEditorState) => {
        this.setState({editorState: newState});
        const blocks = newState.getCurrentContent().getBlockMap();
        const lines = blocks.map((block: any) => block.text).toArray();
        this.props.onLoadProgram(lines);
    }

    blockRenderer = () => {
        return {
            component: EditorLine,
            editable: true
        };
    }

    render() {
        return (
            <div className='editor'>
                <DraftEditor
                    editorState={this.state.editorState}
                    onChange={this.onEditorChange}
                    blockRendererFn={this.blockRenderer}
                />
            </div>
        )
    }
}

export default Editor;
