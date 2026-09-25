const openAiContentToEnsembleContent = (content) => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return String(content ?? '');

    const converted = [];
    for (const part of content) {
        if (!part || typeof part !== 'object') {
            continue;
        }

        // OpenAI message format: {type:'text', text:'...'}
        if (part.type === 'text' && typeof part.text === 'string') {
            converted.push({ type: 'input_text', text: part.text });
            continue;
        }

        // OpenAI message format: {type:'image_url', image_url:{url:'...'}}
        if (part.type === 'image_url') {
            const url = part.image_url?.url;
            if (typeof url === 'string' && url.length > 0) {
                converted.push({ type: 'input_image', detail: 'auto', image_url: url });
            }
            continue;
        }

        // Fallback to stringifying unknown parts.
        try {
            converted.push({ type: 'input_text', text: JSON.stringify(part) });
        } catch {
            converted.push({ type: 'input_text', text: String(part) });
        }
    }

    if (converted.length === 0) return '';
    if (converted.length === 1 && converted[0].type === 'input_text') return converted[0].text;
    return converted;
};

const openAiMessagesToEnsembleInput = (messages) => {
    return (messages || []).map((message) => {
        const role = message.role;
        let content = openAiContentToEnsembleContent(message.content);
        const name = typeof message.name === 'string' ? message.name : undefined;
        const signature = message.signature ? openAiContentToEnsembleContent(message.signature) : undefined;

        // Provider compatibility: avoid passing `name` fields into the provider request.
        // Some providers only support `name` for user messages (or not at all).
        if (role === 'user' && name) {
            if (typeof content === 'string') {
                content = `${name}: ${content}`;
            }
            else if (Array.isArray(content)) {
                if (content.length > 0 && content[0]?.type === 'input_text') {
                    content[0].text = `${name}: ${content[0].text}`;
                }
                else {
                    content.unshift({ type: 'input_text', text: `${name}:` });
                }
            }
        }

        if (message.type === 'thinking') {
            return {
                type: 'thinking',
                role: 'assistant',
                status: 'completed',
                content,
                signature,
                thinking_id: typeof message.thinking_id === 'string' ? message.thinking_id : undefined,
                model: typeof message.model === 'string' ? message.model : undefined,
            };
        }

        if (role === 'assistant') {
            return {
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content,
            };
        }

        if (role === 'tool') {
            // Legacy tool message shape in this codebase is OpenAI-like:
            // { role:'tool', tool_call_id:'...', content:'...' }
            // Ensemble expects function_call_output messages.
            return {
                type: 'function_call_output',
                call_id: message.tool_call_id || 'tool',
                output: typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? ''),
            };
        }

        // Default to developer/user/system input messages.
        return {
            type: 'message',
            role: role === 'system' ? 'system' : role === 'developer' ? 'developer' : 'user',
            content,
        };
    });
};

const ensembleContentToString = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (!part || typeof part !== 'object') return '';
                if (part.type === 'input_text' && typeof part.text === 'string') return part.text;
                if (part.type === 'input_image') return '';
                if (part.type === 'input_file') return '';
                return '';
            })
            .join('');
    }
    return String(content ?? '');
};

const normalizeThinkingOutput = (message) => {
    if (!message || message.type !== 'thinking') return null;
    return {
        model: typeof message.model === 'string' ? message.model : null,
        thinking_id: typeof message.thinking_id === 'string' ? message.thinking_id : null,
        content: ensembleContentToString(message.content),
        signature: message.signature ? ensembleContentToString(message.signature) : '',
    };
};

const isThinkingCompatibleWithModel = (item, model, provider) => {
    if (!item || item.type !== 'thinking') return true;

    const itemModel = typeof item.model === 'string' ? item.model : null;
    if (itemModel && itemModel !== model) {
        return false;
    }

    if (provider === 'openai') {
        // OpenAI provider only treats thinking as reasoning continuity if thinking_id matches the rs_* format.
        // Otherwise it degrades into a user message "Thinking: ...".
        if (typeof item.thinking_id !== 'string') return false;
        return /^rs_[A-Za-z0-9]+-\d$/.test(item.thinking_id);
    }

    if (provider === 'anthropic') {
        // Claude provider only passes thinking safely when a signature is present.
        const sig = item.signature ? ensembleContentToString(item.signature) : '';
        return sig.trim().length > 0;
    }

    if (provider === 'google') {
        // Gemini supports thought parts; treat as compatible.
        return true;
    }

    // Unknown provider behavior: avoid passing thinking.
    return false;
};


export { openAiMessagesToEnsembleInput, ensembleContentToString, normalizeThinkingOutput, isThinkingCompatibleWithModel };
