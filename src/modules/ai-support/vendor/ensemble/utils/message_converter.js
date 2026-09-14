import { randomUUID } from 'node:crypto';
export function convertToThinkingMessage(event, model) {
    return {
        id: event.message_id || randomUUID(),
        type: 'thinking',
        role: 'assistant',
        content: event.thinking_content || '',
        signature: event.thinking_signature || '',
        thinking_id: event.message_id || '',
        status: 'completed',
        model,
        timestamp: event.timestamp ? new Date(event.timestamp).getTime() : undefined,
    };
}
export function convertToOutputMessage(event, model, status = 'completed') {
    return {
        id: event.message_id || randomUUID(),
        type: 'message',
        role: 'assistant',
        content: event.content,
        status,
        model,
        timestamp: event.timestamp ? new Date(event.timestamp).getTime() : undefined,
    };
}
export function convertToFunctionCall(toolCall, model, status = 'completed') {
    return {
        id: toolCall.id || randomUUID(),
        type: 'function_call',
        call_id: toolCall.call_id || toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        ...(toolCall.thought_signature ? { thought_signature: toolCall.thought_signature } : {}),
        ...(toolCall.reasoning_content ? { reasoning_content: toolCall.reasoning_content } : {}),
        model,
        status,
        timestamp: Date.now(),
    };
}
export function convertToFunctionCallOutput(toolResult, model, status = 'completed') {
    const id = toolResult.id ? `${toolResult.id}_output` : randomUUID();
    return {
        id,
        type: 'function_call_output',
        call_id: toolResult.call_id || toolResult.toolCall.id,
        name: toolResult.toolCall.function.name,
        output: toolResult.output + (toolResult.error || ''),
        model,
        status,
        timestamp: Date.now(),
    };
}
export function ensureMessageId(message) {
    if (!message.id) {
        message.id = randomUUID();
    }
    return message;
}
