import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useReplySuggestions } from '../contexts/ConversationSuggestionsContext';

export default function ConversationAIInstructions() {
    const { currentAI, disabled, instructions, regenerate, setInstructions, suggestions } = useReplySuggestions();
    const textareaRef = useRef(null);
    const isBusy = disabled || suggestions.loading;
    const instructionLabel = `Tell ${currentAI ? currentAI.name : 'the AI'} how to reply`;

    const generate = event => {
        event.preventDefault();
        if (!isBusy) regenerate();
    };

    const focusInput = event => {
        if (isBusy || !(event.target instanceof Element)) return;
        if (event.target.closest('button, textarea, a, input, select, [role="button"]')) return;
        if (window.getSelection()?.type === 'Range') return;
        textareaRef.current?.focus({ preventScroll: true });
    };

    return <form className="conversation-ai-instructions" onSubmit={ generate } onClick={ focusInput } aria-label="AI reply instructions">
        <TextareaAutosize
            ref={ textareaRef }
            id="conversation-ai-instructions"
            className="form-control form-control-flush"
            value={ instructions }
            onChange={ event => setInstructions(event.target.value) }
            placeholder={ `${instructionLabel}…` }
            aria-label={ instructionLabel }
            maxLength={ 2000 }
            minRows={ 1 }
            maxRows={ 10 }
            disabled={ isBusy }
        />
        <div className="conversation-ai-instructions__footer">
            <button type="submit" className="btn btn-primary" disabled={ isBusy }>
                <i className="fe fe-star" aria-hidden="true" /> Generate
            </button>
        </div>
    </form>;
}
