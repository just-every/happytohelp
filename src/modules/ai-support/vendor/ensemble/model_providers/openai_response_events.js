function getOutputText(response) {
    if (typeof response?.output_text === 'string' && response.output_text.length > 0) {
        return response.output_text;
    }
    return undefined;
}
function extractMessageText(item) {
    if (!Array.isArray(item?.content)) {
        return '';
    }
    return item.content
        .map((part) => {
        if (part?.type === 'output_text' && typeof part.text === 'string') {
            return part.text;
        }
        if (part?.type === 'text' && typeof part.text === 'string') {
            return part.text;
        }
        return '';
    })
        .join('');
}
function extractReasoningSummaries(item) {
    if (!Array.isArray(item?.summary)) {
        return [];
    }
    return item.summary
        .map((part) => {
        if (typeof part === 'string') {
            return part;
        }
        if (typeof part?.text === 'string') {
            return part.text;
        }
        return '';
    })
        .filter((text) => text.length > 0);
}
export function buildEventsFromOpenAIResponse(response) {
    const events = [];
    const outputItems = Array.isArray(response?.output) ? response.output : [];
    for (const item of outputItems) {
        if (item?.type === 'reasoning') {
            extractReasoningSummaries(item).forEach((summary, index) => {
                events.push({
                    type: 'message_complete',
                    content: '',
                    message_id: `${item.id || 'reasoning'}-${index}`,
                    thinking_content: summary,
                });
            });
            continue;
        }
        if (item?.type === 'function_call') {
            events.push({
                type: 'tool_start',
                tool_call: {
                    id: item.id || item.call_id,
                    call_id: item.call_id,
                    type: 'function',
                    function: {
                        name: item.name || '',
                        arguments: item.arguments || '',
                    },
                },
            });
            continue;
        }
        if (item?.type === 'message') {
            const content = extractMessageText(item);
            if (content.length > 0) {
                events.push({
                    type: 'message_complete',
                    content,
                    message_id: item.id || `msg_${events.length}`,
                });
            }
        }
    }
    if (!events.some(event => event.type === 'message_complete' && 'content' in event && event.content)) {
        const outputText = getOutputText(response);
        if (outputText) {
            events.push({
                type: 'message_complete',
                content: outputText,
                message_id: response?.id || 'response',
            });
        }
    }
    return events;
}
