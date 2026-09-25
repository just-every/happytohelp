import React, { createContext, useContext } from 'react';
import useConversationSuggestions from '../hooks/useConversationSuggestions';

const ConversationSuggestionsContext = createContext(null);

export function ConversationSuggestionsProvider({ children, ...options }) {
    const suggestions = useConversationSuggestions(options);
    return <ConversationSuggestionsContext.Provider value={ suggestions }>
        { children }
    </ConversationSuggestionsContext.Provider>;
}

export function useReplySuggestions() {
    const suggestions = useContext(ConversationSuggestionsContext);
    if (!suggestions) throw new Error('Reply suggestions require a conversation provider.');
    return suggestions;
}
