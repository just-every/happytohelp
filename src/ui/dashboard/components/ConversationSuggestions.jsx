import React from 'react';
import AgentAvatar from './AgentAvatar';
import ConversationSuggestionCard from './ConversationSuggestionCard';
import { useReplySuggestions } from '../contexts/ConversationSuggestionsContext';
import ConversationAIInstructions from './ConversationAIInstructions';

export default function ConversationSuggestions({ hasHiddenAbove, hasHiddenBelow, scrollRef }) {
    const {
        currentAI, disabled, regenerate, selectSuggestion, selectedSuggestion, suggestions,
    } = useReplySuggestions();
    const hasReplyOptions = suggestions.responses.some(suggestion => suggestion?.response);

    return (
        <div className="conversation-suggestions">
            { currentAI && <div className="conversation-suggestions__agent">
                <AgentAvatar agent={ currentAI } className="avatar-sm" />
                <span>{ currentAI.name }’s Suggestions</span>
            </div> }

            <div className={ `conversation-suggestions__scroll-region${ hasHiddenAbove ? ' has-hidden-above' : '' }${ hasHiddenBelow ? ' has-hidden-below' : '' }` }>
                <div className="conversation-suggestions__options" ref={ scrollRef } aria-live="polite">
                    { suggestions.error && <div className="conversation-suggestions__error" role="alert">
                        <span>{ suggestions.error }</span>
                        <button type="button" className="btn btn-link" onClick={ regenerate } disabled={ disabled }>Try again</button>
                    </div> }
                    { suggestions.loading && <div className="conversation-suggestions__loading" role="status">
                        <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                        <span>{ suggestions.loading_message || 'Generating reply suggestions…' }</span>
                    </div> }

                    { !suggestions.loading && !suggestions.error && !hasReplyOptions && <button
                        type="button"
                        className="btn btn-white conversation-suggestions__empty"
                        onClick={ regenerate }
                        disabled={ disabled }
                    >
                        <i className="fe fe-star" aria-hidden="true" />
                        Generate replies
                    </button> }

                    { suggestions.responses.map((suggestion, index) => {
                        if (!suggestion?.response) return null;

                        return <ConversationSuggestionCard
                            key={ `${ suggestion.button }-${ index }` }
                            label={ suggestion.button }
                            icon={ suggestion.icon }
                            response={ suggestion.response }
                            useWhen={ suggestion.use_when }
                            selected={ selectedSuggestion === index }
                            disabled={ disabled || suggestions.loading }
                            onSelect={ () => selectSuggestion(suggestion, index) }
                        />;
                    }) }
                </div>
            </div>

            <ConversationAIInstructions />

        </div>
    );
}
