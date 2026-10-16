function conversationRows(result) {
    if (!Array.isArray(result?.data)) {
        throw new Error('Conversation list response did not include conversation rows');
    }

    return result.data;
}

function hasNextConversationPage(result) {
    const pagination = result?.meta?.pagination;
    const currentPage = Number(pagination?.current_page);
    const totalPages = Number(pagination?.total_pages);

    if (!Number.isInteger(currentPage) || !Number.isInteger(totalPages) || currentPage < 1 || totalPages < currentPage) {
        throw new Error('Conversation list response did not include valid pagination');
    }

    return currentPage < totalPages;
}

function uniqueConversations(conversations) {
    const seen = new Set();

    return conversations.filter(conversation => {
        if (!conversation?.id || seen.has(conversation.id)) {
            return false;
        }

        seen.add(conversation.id);
        return true;
    });
}

function appendConversationPage(existingConversations, result) {
    return uniqueConversations([ ...existingConversations, ...conversationRows(result) ]);
}

async function refreshConversationPages({ fetchPage, filter, loadedCount, signal, isCurrent, initialInboxListRead = false }) {
    let conversations = [];
    let nextFilter = filter;
    let shouldFetchPage = true;
    let nextPageExists = false;

    while (shouldFetchPage) {
        const result = await fetchPage(nextFilter, { signal,
            ...(initialInboxListRead && nextFilter === filter ? {initialInboxListRead: true} : {}),
        });
        if (!isCurrent()) {
            return null;
        }

        const priorLength = conversations.length;
        conversations = appendConversationPage(conversations, result);
        nextPageExists = hasNextConversationPage(result);
        const lastConversation = conversations[conversations.length - 1];
        const madeProgress = conversations.length > priorLength;

        if (!madeProgress) {
            nextPageExists = false;
        }

        shouldFetchPage = conversations.length < loadedCount
            && nextPageExists
            && madeProgress
            && Boolean(lastConversation);

        if (shouldFetchPage) {
            nextFilter = {
                ...filter,
                last_message_before: lastConversation.last_message_at,
                last_conversation_before: lastConversation.id,
            };
        }
    }

    return {
        conversations,
        hasNextPage: nextPageExists && conversations.length > 0,
    };
}

function isAbortedConversationRequest(error) {
    return error?.name === 'AbortError';
}

export {
    appendConversationPage,
    hasNextConversationPage,
    isAbortedConversationRequest,
    refreshConversationPages,
};
