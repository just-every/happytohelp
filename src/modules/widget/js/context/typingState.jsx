export const emptyTypingState = () => ({ typing: false, message: '' });

export const normalizeTypingMessage = (message) => (
    typeof message === 'string' ? message.trim() : ''
);

export const normalizeTypingState = (typing = {}) => ({
    ...typing,
    typing: Boolean(typing?.typing),
    message: normalizeTypingMessage(typing?.message),
});

export const insightTypingState = (insight, agent) => normalizeTypingState({
    typing: true,
    message: insight?.metadata?.loading,
    agent,
});
