

const BASE_PROVIDER = Symbol.for('happytohelp.assist.base-provider');

// Provider-native output contracts. Ensemble 0.2.277 only prompts Claude for JSON
// and predates the current adaptive-thinking IDs. Keep this request translation
// isolated from business logic; it never changes the requested model or retries.
const claudeSchema = value => {
    if (Array.isArray(value)) return value.map(claudeSchema);
    if (!value || typeof value !== 'object') return value;
    const unsupported = new Set(['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', '$schema']);
    return Object.fromEntries(Object.entries(value).filter(([key]) => !unsupported.has(key)).map(([key, child]) => [key, claudeSchema(child)]));
};

const applyProviderContract = (params, model, settings = {}) => {
    if (model.startsWith('claude-')) {
        const next = { ...params };
        if (/^claude-(?:fable-5|opus-5|sonnet-5)/.test(model)) {
            const budget = settings.thinking_budget ?? 8192;
            const effort = budget <= 2048 ? 'low' : budget <= 8192 ? 'medium' : budget <= 32768 ? 'high' : 'xhigh';
            next.thinking = { type: 'adaptive' };
            next.output_config = { ...next.output_config, effort };
            delete next.temperature;
        }
        if (settings.json_schema?.schema) {
            next.output_config = { ...next.output_config, format: { type: 'json_schema', schema: claudeSchema(settings.json_schema.schema) } };
        }
        if (params.tools?.length) {
            next.tools = params.tools.map(tool => tool.input_schema ? {
                ...tool,
                strict: true,
                input_schema: { ...claudeSchema(tool.input_schema), additionalProperties: false },
            } : tool);
        }
        return next;
    }
    if (/^gpt-(?:5\.[56]|6)/.test(model)) {
        const next = { ...params, ...(settings.max_tokens ? { max_output_tokens: settings.max_tokens } : {}) };
        delete next.temperature;
        delete next.top_p;
        delete next.top_logprobs;
        return next;
    }
    return params;
};

const assistProvider = provider => {
    const base = provider[BASE_PROVIDER] || provider;
    const wrapper = Object.create(base);
    wrapper[BASE_PROVIDER] = base;
    wrapper.createResponseStream = async function* (messages, model, agent, requestId) {
        if (!model.startsWith('claude-') && !/^gpt-(?:5\.[56]|6)/.test(model)) {
            yield* base.createResponseStream(messages, model, agent, requestId);
            return;
        }
        const client = base.client;
        const scopedClient = Object.create(client);
        const resourceName = model.startsWith('claude-') ? 'messages' : 'responses';
        const resource = Object.create(client[resourceName]);
        resource.create = (params, options) => client[resourceName].create(applyProviderContract(params, model, agent?.modelSettings), options);
        Object.defineProperty(scopedClient, resourceName, { value: resource });
        const scopedProvider = Object.create(base);
        Object.defineProperty(scopedProvider, 'client', { value: scopedClient });
        yield* base.createResponseStream.call(scopedProvider, messages, model, agent, requestId);
    };
    return wrapper;
};

export { applyProviderContract, assistProvider, claudeSchema };
