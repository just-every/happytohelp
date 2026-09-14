

const messageId = message => message?.get?.('id') || message?.id || null;

const triggerForMessage = (kind, message) => {
    const id = messageId(message);
    if (!id) return null;
    return { kind, key: `${kind}:${id}`, message_id: id };
};

const customerMessageTrigger = message => triggerForMessage('customer_message', message);
const assignmentTrigger = message => {
    const id = messageId(message);
    return {
        kind: 'ai_assignment',
        key: `ai_assignment:${id || 'empty'}`,
        message_id: id || null,
    };
};
const insightTrigger = message => triggerForMessage('insight_activation', message);

// Opening the widget has no durable event row. Key it to the message frontier so
// duplicate delivery cannot start another greeting, while a later real message
// can legitimately start a new lifecycle.
const instructionTrigger = (action, message) => {
    const id = messageId(message);
    const normalizedAction = typeof action === 'string' ? action.trim() : '';
    if (!normalizedAction) return null;
    return {
        kind: 'instruction',
        key: `instruction:${normalizedAction}:${id || 'empty'}`,
        message_id: id || null,
    };
};

export {
    assignmentTrigger,
    customerMessageTrigger,
    insightTrigger,
    instructionTrigger,
    triggerForMessage,
};
