function mergeMessage(messages = [], message) {
    const index = messages.findIndex(item =>
        (message.id && item.id === message.id)
        || (message.local_id && !item.id && item.local_id === message.local_id)
    );
    return index < 0
        ? [ ...messages, message ]
        : messages.map((item, position) => position === index ? { ...item, ...message } : item);
}

function mergeBucketMessage(buckets, message) {
    return buckets.map(bucket => bucket.id === message.bucket_id ? {
        ...bucket,
        ...message.bucket,
        id: bucket.id,
        conversation_id: bucket.conversation_id,
        messages: mergeMessage(bucket.messages, message),
    } : bucket);
}

export { mergeMessage, mergeBucketMessage };
