export const clearMatchingReplyTyping = (typing, localId) => {
    if (!localId || typing?.local_id !== localId) return typing;
    return { typing: false, message: '', local_id: localId };
};

export const removePartialReply = (messages, localId) => (
    messages.filter(message => !(
        message.local_id === localId
        && message.chunked
        && !message.chunked_complete
    ))
);

export const cancelReplyStream = ({ chunks, cancelledIds, localId }) => {
    if (!localId || chunks[localId]?.complete) return false;
    cancelledIds.add(localId);
    delete chunks[localId];
    return true;
};

export const isCancelledReply = (cancelledIds, localId) => (
    Boolean(localId) && cancelledIds.has(localId)
);
