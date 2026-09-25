import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useReplySuggestions } from '../contexts/ConversationSuggestionsContext';
import { submitInstructionsOnEnter } from '../utils/submitInstructionsOnEnter';

export default function ConversationAIInstructions() {
    const { canGenerateSuggestions, currentAI, disabled, instructions, regenerate, setInstructions, suggestions } = useReplySuggestions();
    const textareaRef = useRef(null);
    const composingRef = useRef(false);
    const isBusy = disabled || suggestions.loading;
    const isUnavailable = !canGenerateSuggestions;
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
            onCompositionStart={ () => { composingRef.current = true; } }
            onCompositionEnd={ () => { composingRef.current = false; } }
            onKeyDown={ event => submitInstructionsOnEnter(event, { busy: isBusy, composing: composingRef.current }) }
            placeholder="Reply instructions…"
            aria-label={ instructionLabel }
            maxLength={ 2000 }
            minRows={ 1 }
            maxRows={ 10 }
            disabled={ isBusy || isUnavailable }
        />
        <div className="conversation-ai-instructions__footer">
            <button type="submit" className="btn btn-primary" disabled={ isBusy || isUnavailable } aria-describedby={ isUnavailable ? 'conversation-ai-instructions-message-required' : undefined }>
                <i className="fe fe-star" aria-hidden="true" /> Generate
            </button>
            { isUnavailable && <span id="conversation-ai-instructions-message-required" className="conversation-ai-instructions__hint" role="status">Add a customer message first.</span> }
        </div>
    </form>;
}
