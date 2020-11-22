import React, { Component, CSSProperties } from 'react';
import { Editor as DraftEditor, EditorState as DraftEditorState, ContentState, ContentBlock, CompositeDecorator } from 'draft-js';
import EditorLine from './editorLine';
import '../style/editor.scss';

interface EditorProps {
    setProgramText: (p: string[]) => void,
}

interface EditorState {
    editorState: DraftEditorState,
    currentLineKey: string
}

const preloadedStates = {
    'test': ['ADD R0, R0, #1', 'ADD R1, R1, #2', 'ADD R2, R0, R2', 'ADD R3, R1, R2'].join('\n')
};

function findWithRegex(regex: RegExp, callback: any, contentBlock: ContentBlock) {
    const text = contentBlock.getText();
    const matches = [...text.matchAll(regex)];
    matches.forEach(match => {
        if (match.index) {
            callback(match.index, match.index + match[0].length);
        }
    });
  }

function registerStrategy(contentBlock: ContentBlock, callback: any, contentState: ContentState) {
    findWithRegex(/([Rr]\d+)/g, callback, contentBlock);
}

const registerSpan = (props: any) => {
    return <span style={{color: 'seagreen'}}>
        { props.children }
    </span>
}

function immediateStrategy(contentBlock: ContentBlock, callback: any, contentState: ContentState) {
    findWithRegex(/([Rr]\d+)/g, callback, contentBlock);
    findWithRegex(/#[\dxa-fA-F]+/g, callback, contentBlock);
}

const immediateSpan = (props: any) => {
    return <span style={{color: 'salmon'}}>
        { props.children }
    </span>
}

const compositeDecorator : CompositeDecorator = new CompositeDecorator([
    {
        strategy: registerStrategy,
        component: registerSpan
    },
    {
        strategy: immediateStrategy,
        component: immediateSpan
    }
]);

class Editor extends Component<EditorProps, EditorState> {

    constructor(props: EditorProps) {
        super(props);
        this.state = {
            editorState: DraftEditorState.createWithContent(ContentState.createFromText(preloadedStates.test), compositeDecorator),
            currentLineKey: ''
        };

        const blocks = this.state.editorState.getCurrentContent().getBlockMap();
        const lines = blocks.map((block: any) => block.text).toArray();
        this.props.setProgramText(lines);
    }

    onEditorChange = (newState: DraftEditorState) => {
        const blocks = newState.getCurrentContent().getBlockMap();
        const lines = blocks.map((block: any) => block.text).toArray();
        this.props.setProgramText(lines);
        const currentBlockKey = newState.getSelection().getStartKey();
        if (currentBlockKey !== this.state.currentLineKey) {
            // this.props.onSelectLine(newState.getCurrentContent().getBlockMap().get(currentBlockKey).getText());
            DraftEditorState.forceSelection(newState, newState.getSelection())
        }
        this.setState({editorState: newState, currentLineKey: currentBlockKey});
    }

    blockRenderer = (contentBlock: ContentBlock) => {
        const currentLine = this.state.currentLineKey === contentBlock.getKey();
        return {
            component: EditorLine,
            props: {
                currentLine
            },
            editable: true
        };
    }

    render() {
        return (
            <div className='editor panel'>
                <h1 className='header'>Assembly Editor</h1>
                <div className='content'>
                    <DraftEditor
                        editorState={this.state.editorState}
                        onChange={this.onEditorChange}
                        blockRendererFn={this.blockRenderer}/>
                </div>
            </div>
        )
    }
}

export default Editor;
