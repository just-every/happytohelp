import React from 'react';
import PropTypes from 'prop-types';
import Dropdown from 'react-bootstrap/Dropdown';
import { useReplySuggestions } from '../contexts/ConversationSuggestionsContext';

const rewriteTools = [
    { name: 'improve', label: 'Improve writing', icon: 'fe-star' },
    { name: 'extend', label: 'Make longer', icon: 'fe-align-left' },
    { name: 'shorten', label: 'Make shorter', icon: 'fe-align-center' },
];

export default function ConversationComposerTools({ disabled, hasHelper, canSend, onAttach, onSaved, onNote, onSendAndClose }) {
    const { canRunTools, canUndo, canRedo, runTool, undo, redo, suggestions } = useReplySuggestions();
    const historyDisabled = disabled || hasHelper || suggestions.loading;

    return <Dropdown drop="up" align="end" className="conversation-composer__tools-menu">
        <Dropdown.Toggle
            id="conversation-composer-tools"
            variant="link"
            className="conversation-composer__tools-toggle"
            disabled={ disabled }
            aria-label="Reply tools">
            <i className="fe fe-plus" aria-hidden="true" />
        </Dropdown.Toggle>
        <Dropdown.Menu role="menu" aria-label="Reply tools">
            <Dropdown.Header>Add to conversation</Dropdown.Header>
            <Dropdown.Item as="button" type="button" role="menuitem" onClick={ onAttach } disabled={ hasHelper }>
                <i className="fe fe-paperclip" aria-hidden="true" /> Attach file
            </Dropdown.Item>
            <Dropdown.Item as="button" type="button" role="menuitem" onClick={ onSaved }>
                <i className="fe fe-bookmark" aria-hidden="true" /> { hasHelper ? 'Back to reply' : 'Saved replies' }
            </Dropdown.Item>
            <Dropdown.Item as="button" type="button" role="menuitem" onClick={ onNote } aria-haspopup="dialog">
                <i className="fe fe-lock" aria-hidden="true" /> Internal note
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Header>Write with AI</Dropdown.Header>
            { rewriteTools.map(tool => <Dropdown.Item
                key={ tool.name }
                as="button"
                type="button"
                role="menuitem"
                onClick={ () => runTool(tool.name) }
                disabled={ !canRunTools }>
                <i className={ `fe ${tool.icon}` } aria-hidden="true" /> { tool.label }
            </Dropdown.Item>) }
            <Dropdown.Divider />
            <Dropdown.Item as="button" type="button" role="menuitem" onClick={ undo } disabled={ historyDisabled || !canUndo }>
                <i className="fe fe-corner-up-left" aria-hidden="true" /> Undo draft change
            </Dropdown.Item>
            <Dropdown.Item as="button" type="button" role="menuitem" onClick={ redo } disabled={ historyDisabled || !canRedo }>
                <i className="fe fe-corner-up-right" aria-hidden="true" /> Redo draft change
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item as="button" type="button" role="menuitem" onClick={ onSendAndClose } disabled={ !canSend }>
                <i className="fe fe-check-circle" aria-hidden="true" /> Send &amp; close
            </Dropdown.Item>
        </Dropdown.Menu>
    </Dropdown>;
}

ConversationComposerTools.propTypes = {
    disabled: PropTypes.bool,
    hasHelper: PropTypes.bool,
    canSend: PropTypes.bool,
    onAttach: PropTypes.func.isRequired,
    onSaved: PropTypes.func.isRequired,
    onNote: PropTypes.func.isRequired,
    onSendAndClose: PropTypes.func.isRequired,
};
