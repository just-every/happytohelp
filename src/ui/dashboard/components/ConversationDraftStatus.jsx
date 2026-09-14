import React from 'react';
import { useReplySuggestions } from '../contexts/ConversationSuggestionsContext';

export default function ConversationDraftStatus() {
    const { activeTool, lastRequestKind, suggestions } = useReplySuggestions();
    if (activeTool) return <span className="conversation-composer__status" role="status">
        <i className="fe fe-star" aria-hidden="true" />
        { suggestions.loading_message || 'Updating your draft…' }
    </span>;

    if (lastRequestKind === 'tool' && suggestions.error) return <span className="conversation-composer__error" role="alert">
        { suggestions.error }
    </span>;

    return null;
}
