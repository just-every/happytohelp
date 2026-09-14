const selectionMatchesDraft = (selection, conversationId, message) => (
    Boolean(selection)
    && selection.conversationId === conversationId
    && selection.response === message
);

const nextReplySuggestionSelection = ({
    selection,
    conversationId,
    message,
    suggestionIndex,
    suggestionResponse,
}) => {
    const activeSelection = selectionMatchesDraft(selection, conversationId, message)
        ? selection
        : null;

    if (
        activeSelection?.index === suggestionIndex
        && activeSelection.response === suggestionResponse
    ) {
        return {
            action: 'deselect',
            message: activeSelection.baseline,
            rememberDraft: false,
            selection: null,
        };
    }

    return {
        action: activeSelection ? 'switch' : 'select',
        message: suggestionResponse,
        rememberDraft: !activeSelection,
        selection: {
            baseline: activeSelection ? activeSelection.baseline : message,
            conversationId,
            index: suggestionIndex,
            response: suggestionResponse,
        },
    };
};

const shouldClearReplySuggestionSelection = ({
    selection,
    conversationId,
    previousMessage,
    message,
}) => (
    previousMessage !== message
    && Boolean(selection)
    && selection.conversationId === conversationId
    && selection.response !== message
);

const shouldClearReplySuggestionForResponses = (selection, responses) => (
    Boolean(selection)
    && selection.response !== responses?.[selection.index]?.response
);

export {
    nextReplySuggestionSelection,
    selectionMatchesDraft,
    shouldClearReplySuggestionForResponses,
    shouldClearReplySuggestionSelection,
};
