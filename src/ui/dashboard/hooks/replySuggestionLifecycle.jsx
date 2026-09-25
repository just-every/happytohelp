const terminalStatus = new Set(['complete', 'error', 'superseded']);
const CLIENT_SUGGESTION_DEADLINE_MS = 90000;

const nonNegativeInteger = value => (
    Number.isSafeInteger(value) && value >= 0 ? value : null
);

const suggestionDeadlineDelay = (suggestions, now = Date.now()) => {
    if (!suggestions?.loading) return null;
    const deadline = Date.parse(
        suggestions.generation_deadline_at
        || suggestions.client_deadline_at
        || ''
    );
    return Number.isFinite(deadline) ? Math.max(0, deadline - now) : CLIENT_SUGGESTION_DEADLINE_MS;
};

const optimisticSuggestionState = (suggestions, {
    clientRequestId = '',
    displayRequestVersion,
    loadingMessage = '',
    clearToolResponse = false,
    now = Date.now(),
} = {}) => {
    const {
        client_deadline_at: _clientDeadlineAt,
        client_timeout: _clientTimeout,
        conversation_revision: _conversationRevision,
        generation_deadline_at: _generationDeadlineAt,
        generation_id: _generationId,
        generation_sequence: previousGenerationSequence,
        generation_started_at: _generationStartedAt,
        ...previous
    } = suggestions || {};

    return {
        ...previous,
        client_request_id: clientRequestId,
        display_request_version: displayRequestVersion,
        loading: true,
        loading_message: loadingMessage,
        error: '',
        status: 'loading',
        // This is only a UI recovery deadline. A server lifecycle frame replaces it
        // with its authoritative generation_deadline_at.
        client_deadline_at: new Date(now + CLIENT_SUGGESTION_DEADLINE_MS).toISOString(),
        // Server starts are ordered while their conversation row is locked. Keep the
        // last server sequence through this optimistic state so a delayed earlier
        // frame cannot replace it before the new start arrives.
        previous_generation_sequence: nonNegativeInteger(previousGenerationSequence)
            ?? nonNegativeInteger(suggestions?.previous_generation_sequence),
        responses: Array.isArray(suggestions?.responses) ? suggestions.responses : [],
        tool_response: clearToolResponse ? '' : (suggestions?.tool_response || ''),
    };
};

/**
 * Websocket settings frames can arrive out of order. Server generation sequences are
 * allocated under the conversation-row lock, so they order frames for every browser
 * without comparing client clocks or browser-local request counters.
 */
const shouldUseIncomingSuggestions = (current, incoming) => {
    const currentId = current?.generation_id;
    const incomingId = incoming?.generation_id;
    const currentSequence = nonNegativeInteger(current?.generation_sequence);
    const previousSequence = nonNegativeInteger(current?.previous_generation_sequence);
    const incomingSequence = nonNegativeInteger(incoming?.generation_sequence);
    const watermark = currentId ? currentSequence : previousSequence;

    if (incomingSequence !== null) {
        if (watermark !== null && incomingSequence !== watermark) {
            return incomingSequence > watermark;
        }

        // An optimistic request with the same sequence watermark is still waiting
        // for a newer authoritative start, rather than accepting a delayed old one.
        if (!currentId && watermark !== null) return false;

        // Existing records from before generation_sequence was introduced have no
        // watermark. The first sequenced server frame is authoritative: accept it
        // without asking browser-local request counters or clocks to order it.
        if (watermark === null) {
            if (current?.client_timeout && incoming?.status === 'loading') return false;
            if (currentId === incomingId && terminalStatus.has(current?.status)) return false;
            return true;
        }

        if (currentId && currentId !== incomingId) return false;
    }

    if (!incomingId || !currentId) {
        if (current?.client_timeout) return incoming?.status !== 'loading';
        if (terminalStatus.has(current?.status)) return false;
        return true;
    }

    if (currentId === incomingId) {
        if (current.client_timeout) return incoming.status !== 'loading';
        if (terminalStatus.has(current.status)) return false;
        return true;
    }

    // A generation ID without the server ordering sequence is legacy data. Prefer
    // the visible state rather than guessing from unrelated client/server clocks.
    return false;
};

const mergeConversationSuggestionMetadata = (currentConversation, updatedConversation, { localSuggestions = false } = {}) => {
    const currentMetadata = currentConversation?.metadata || {};
    const incomingMetadata = updatedConversation?.metadata;
    if (!incomingMetadata || Array.isArray(incomingMetadata) || typeof incomingMetadata !== 'object') {
        return { ...currentConversation, ...updatedConversation };
    }

    const currentSuggestions = currentMetadata.suggestions;
    const incomingSuggestions = incomingMetadata.suggestions;
    const suggestions = incomingSuggestions && (localSuggestions || shouldUseIncomingSuggestions(currentSuggestions, incomingSuggestions))
        ? incomingSuggestions
        : currentSuggestions;

    return {
        ...currentConversation,
        ...updatedConversation,
        metadata: {
            ...currentMetadata,
            ...incomingMetadata,
            ...(suggestions ? { suggestions } : {}),
        },
    };
};

const shouldApplyToolSuggestion = ({ request, suggestions, conversationId, draft }) => (
    Boolean(request)
    && request.conversationId === conversationId
    && request.clientRequestId === suggestions?.client_request_id
    && request.draft === draft
    && typeof suggestions?.tool_response === 'string'
    && suggestions.tool_response.length > 0
    && suggestions.status === 'complete'
);

export {
    CLIENT_SUGGESTION_DEADLINE_MS,
    optimisticSuggestionState,
    suggestionDeadlineDelay,
    mergeConversationSuggestionMetadata,
    shouldApplyToolSuggestion,
    shouldUseIncomingSuggestions,
};
