import { BaseModelProvider } from './base_provider.js';
import OpenAI, { APIError } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { costTracker } from '../utils/cost_tracker.js';
import { log_llm_error, log_llm_request, log_llm_response } from '../utils/llm_logger.js';
import { isPaused } from '../utils/pause_controller.js';
import { appendMessageWithImage, normalizeImageDataUrl } from '../utils/image_utils.js';
import { mapOpenAIChatImageDetail } from '../utils/image_detail.js';
import { bufferDelta, flushBufferedDeltas } from '../utils/delta_buffer.js';
import { createCitationTracker, formatCitation, generateFootnotes } from '../utils/citation_tracker.js';
import { hasEventHandler } from '../utils/event_controller.js';
import { createProviderErrorEvent } from '../utils/failure_detection.js';
import { findModel } from '../data/model_data.js';
import { createChatJsonSchemaResponseFormat } from '../utils/structured_output.js';
import { normalizeOpenAIChatUsage } from '../utils/provider_usage.js';
const SIMULATED_TOOL_CALL_REGEX = /\n?\s*(?:```(?:json)?\s*)?\s*TOOL_CALLS:\s*(\[.*\])(?:\s*```)?/gs;
const TOOL_CALL_CLEANUP_REGEX = /\n?\s*(?:```(?:json)?\s*)?\s*TOOL_CALLS:\s*\[.*\](?:\s*```)?/gms;
function formatToolsForPrompt(tools) {
    if (!tools || tools.length === 0) {
        return 'No tools are available for use.';
    }
    const toolDescriptions = tools
        .map(tool => {
        if (tool.type !== 'function' || !tool.function) {
            return `  - Unknown tool type: ${tool.type}`;
        }
        const func = tool.function;
        const parameters = func.parameters && typeof func.parameters === 'object' ? func.parameters : {};
        const properties = 'properties' in parameters ? parameters.properties : {};
        const requiredParams = 'required' in parameters && Array.isArray(parameters.required) ? parameters.required : [];
        const paramsJson = JSON.stringify(properties, null, 2);
        return `  - Name: ${func.name}\n    Description: ${func.description || 'No description'}\n    Parameters (JSON Schema): ${paramsJson}\n    Required Parameters: ${requiredParams.join(', ') || 'None'}`;
    })
        .join('\n\n');
    return `You have the following tools available:\n${toolDescriptions}\n\nTo use one or more tools, output the following JSON structure containing an ARRAY of tool calls on a new line *at the very end* of your response, and *only* if you intend to call tool(s). Ensure the arguments value in each call is a JSON *string*: \n\`\`\`json\nTOOL_CALLS: [ {"id": "call_001", "type": "function", "function": {"name": "function_name_1", "arguments": "{\\"arg1\\": \\"value1\\"}"}}, {"id": "call_002", "type": "function", "function": {"name": "function_name_2", "arguments": "{\\"argA\\": true, \\"argB\\": 123}"}} ]\n\`\`\`\nReplace \`function_name\` and arguments accordingly for each tool call you want to make. Put all desired calls in the array. IMPORTANT: Always include an 'id' field with a unique string for each call. Do not add any text after the TOOL_CALLS line. If you are not calling any tools, respond normally without the TOOL_CALLS structure.`;
}
const CLEANUP_PLACEHOLDER = '[Simulated Tool Calls Removed]';
async function resolveAsyncEnums(params) {
    if (!params || typeof params !== 'object') {
        return params;
    }
    const resolved = { ...params };
    if (resolved.properties) {
        const resolvedProps = {};
        for (const [key, value] of Object.entries(resolved.properties)) {
            if (value && typeof value === 'object') {
                const propCopy = { ...value };
                if (typeof propCopy.enum === 'function') {
                    try {
                        const enumValue = await propCopy.enum();
                        if (Array.isArray(enumValue) && enumValue.length > 0) {
                            propCopy.enum = enumValue;
                        }
                        else {
                            delete propCopy.enum;
                        }
                    }
                    catch {
                        delete propCopy.enum;
                    }
                }
                resolvedProps[key] = await resolveAsyncEnums(propCopy);
            }
            else {
                resolvedProps[key] = value;
            }
        }
        resolved.properties = resolvedProps;
    }
    return resolved;
}
async function convertToOpenAITools(tools) {
    return await Promise.all(tools.map(async (tool) => ({
        type: 'function',
        function: {
            name: tool.definition.function.name,
            description: tool.definition.function.description,
            parameters: await resolveAsyncEnums(tool.definition.function.parameters),
        },
    })));
}
export async function addImagesToInput(input, images, source) {
    for (const [image_id, imageData] of Object.entries(images)) {
        input.push({
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `[image #${image_id}] from the ${source}`,
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: imageData,
                    },
                },
            ],
        });
    }
    return input;
}
async function convertContentPartsToOpenAI(content) {
    if (!Array.isArray(content))
        return [];
    const parts = [];
    for (const item of content) {
        if (item.type === 'input_text') {
            parts.push({
                type: 'text',
                text: item.text || '',
            });
        }
        else if (item.type === 'input_image' || item.type === 'image') {
            const normalized = normalizeImageDataUrl({
                data: 'data' in item ? item.data : undefined,
                image_url: 'image_url' in item ? item.image_url : undefined,
                url: 'url' in item ? item.url : undefined,
                mime_type: 'mime_type' in item ? item.mime_type : undefined,
            });
            const imageUrl = normalized.dataUrl || normalized.url || ('image_url' in item ? item.image_url : '');
            if (!imageUrl)
                continue;
            if (imageUrl.startsWith('data:')) {
                const detail = mapOpenAIChatImageDetail(item.detail);
                parts.push({
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                        ...(detail ? { detail } : {}),
                    },
                });
            }
            else {
                const detail = mapOpenAIChatImageDetail(item.detail);
                parts.push({
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                        ...(detail ? { detail } : {}),
                    },
                });
            }
        }
        else if (item.type === 'input_audio') {
            const data = typeof item.data === 'string'
                ? item.data.replace(/^data:audio\/[^;]+;base64,/, '')
                : Buffer.from(item.data instanceof ArrayBuffer ? new Uint8Array(item.data) : item.data).toString('base64');
            parts.push({
                type: 'input_audio',
                input_audio: { data, format: item.format },
            });
        }
    }
    return parts;
}
async function mapMessagesToOpenAI(messages, model) {
    let result = [];
    const isMistralViaOpenRouter = model.includes('mistral') || model.includes('magistral');
    const replaysReasoningContent = /(?:^|\/)deepseek-v4-/.test(model);
    for (let index = 0; index < messages.length; ++index) {
        const msg = messages[index];
        const message = { ...msg };
        if (replaysReasoningContent && msg.type === 'function_call') {
            const reasoningContent = msg
                .reasoning_content;
            if (typeof reasoningContent === 'string' && reasoningContent.length > 0) {
                const functionCalls = [];
                const functionOutputs = [];
                let cursor = index;
                while (cursor < messages.length) {
                    const candidate = messages[cursor];
                    if (candidate.type === 'function_call') {
                        const candidateReasoning = candidate.reasoning_content;
                        if (candidateReasoning !== reasoningContent)
                            break;
                        functionCalls.push(candidate);
                    }
                    else if (candidate.type === 'function_call_output') {
                        functionOutputs.push(candidate);
                    }
                    else {
                        break;
                    }
                    ++cursor;
                }
                result.push({
                    role: 'assistant',
                    content: null,
                    reasoning_content: reasoningContent,
                    tool_calls: functionCalls.map(functionCall => ({
                        id: functionCall.call_id,
                        type: 'function',
                        function: {
                            name: functionCall.name,
                            arguments: functionCall.arguments,
                        },
                    })),
                });
                for (const functionOutput of functionOutputs) {
                    const toolMessage = {
                        role: 'tool',
                        tool_call_id: functionOutput.call_id,
                        content: functionOutput.output || '',
                    };
                    result = await appendMessageWithImage(model, result, toolMessage, 'content', addImagesToInput);
                }
                index = cursor - 1;
                continue;
            }
        }
        if (msg.type === 'function_call_output') {
            if (isMistralViaOpenRouter) {
                const userMessage = {
                    role: 'user',
                    content: `[Function Response]\nFunction: ${msg.name || 'unknown'}\nResult: ${msg.output || 'No output'}`,
                };
                result = await appendMessageWithImage(model, result, userMessage, 'content', addImagesToInput);
            }
            else {
                const toolMessage = {
                    role: 'tool',
                    tool_call_id: msg.call_id,
                    content: msg.output || '',
                };
                result = await appendMessageWithImage(model, result, toolMessage, 'content', addImagesToInput);
            }
        }
        else if (msg.type === 'function_call') {
            const functionCallMsg = message;
            if (isMistralViaOpenRouter) {
                result.push({
                    role: 'assistant',
                    content: `[Function Call]\nFunction: ${functionCallMsg.name || 'unknown'}\nArguments: ${functionCallMsg.arguments || '{}'}`,
                });
            }
            else {
                result.push({
                    role: 'assistant',
                    tool_calls: [
                        {
                            id: functionCallMsg.call_id,
                            type: 'function',
                            function: {
                                name: functionCallMsg.name || '',
                                arguments: functionCallMsg.arguments || '',
                            },
                        },
                    ],
                });
            }
        }
        else if (!msg.type || msg.type === 'message' || msg.type === 'thinking') {
            if ('content' in message) {
                delete message.type;
                delete message.timestamp;
                delete message.model;
                delete message.pinned;
                delete message.status;
                delete message.thinking_id;
                delete message.signature;
                delete message.id;
                if (message.role === 'developer')
                    message.role = 'system';
                if (!['system', 'user', 'assistant'].includes(message.role)) {
                    message.role = 'user';
                }
                if (Array.isArray(message.content)) {
                    const convertedParts = await convertContentPartsToOpenAI(message.content);
                    if (convertedParts.length > 0) {
                        result.push({
                            role: message.role,
                            content: convertedParts,
                        });
                        continue;
                    }
                }
                result = await appendMessageWithImage(model, result, message, 'content', addImagesToInput);
            }
        }
    }
    return result.filter(Boolean);
}
export class OpenAIChat extends BaseModelProvider {
    _client;
    provider;
    baseURL;
    commonParams = {};
    apiKey;
    defaultHeaders;
    constructor(provider, apiKey, baseURL, defaultHeaders, commonParams) {
        super(provider || 'openai');
        this.provider = provider || 'openai';
        this.apiKey = apiKey;
        this.baseURL = baseURL;
        this.commonParams = commonParams || {};
        this.defaultHeaders = defaultHeaders || {
            'User-Agent': 'magi',
        };
    }
    getEnvVarName() {
        switch (this.provider) {
            case 'openrouter':
                return 'OPENROUTER_API_KEY';
            case 'xai':
                return 'XAI_API_KEY';
            case 'deepseek':
                return 'DEEPSEEK_API_KEY';
            case 'openai':
            default:
                return 'OPENAI_API_KEY';
        }
    }
    get client() {
        if (!this._client) {
            const apiKey = this.apiKey || process.env[this.getEnvVarName()];
            if (!apiKey) {
                throw new Error(`Failed to initialize OpenAI client for ${this.provider}. API key is missing.`);
            }
            this._client = new OpenAI({
                maxRetries: 0,
                apiKey: apiKey,
                baseURL: this.baseURL,
                defaultHeaders: this.defaultHeaders,
            });
        }
        return this._client;
    }
    prepareParameters(requestParams) {
        return requestParams;
    }
    _parseAndPrepareSimulatedToolCalls(aggregatedContent, messageId) {
        const matches = Array.from(aggregatedContent.matchAll(SIMULATED_TOOL_CALL_REGEX));
        let jsonArrayString = null;
        let matchIndex = -1;
        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            if (lastMatch && lastMatch[1]) {
                jsonArrayString = lastMatch[1];
                matchIndex = lastMatch.index ?? -1;
            }
        }
        else {
            if (aggregatedContent.includes('TOOL_CALLS')) {
                console.warn(`(${this.provider}) TOOL_CALLS found but regex didn't match globally. Content snippet:`, aggregatedContent.substring(Math.max(0, aggregatedContent.indexOf('TOOL_CALLS') - 20), Math.min(aggregatedContent.length, aggregatedContent.indexOf('TOOL_CALLS') + 300)));
            }
        }
        if (jsonArrayString !== null && matchIndex !== -1) {
            try {
                let parsedToolCallArray;
                try {
                    parsedToolCallArray = JSON.parse(jsonArrayString);
                }
                catch (initialParseError) {
                    console.error(`(${this.provider}) Failed initial parse. Error: ${initialParseError}. JSON String: ${jsonArrayString}`);
                    throw initialParseError;
                }
                if (!Array.isArray(parsedToolCallArray)) {
                    if (typeof parsedToolCallArray === 'object' && parsedToolCallArray !== null) {
                        parsedToolCallArray = [parsedToolCallArray];
                    }
                    else {
                        throw new Error('Parsed JSON is not an array or object.');
                    }
                }
                const validSimulatedCalls = [];
                for (const callData of parsedToolCallArray) {
                    if (callData && typeof callData === 'object') {
                        const toolCall = {
                            id: callData.id || `sim_${uuidv4()}`,
                            type: 'function',
                            function: {
                                name: '',
                                arguments: '{}',
                            },
                        };
                        const funcDetails = callData.function;
                        if (typeof funcDetails === 'object' && funcDetails !== null) {
                            if (typeof funcDetails.name === 'string') {
                                toolCall.function.name = funcDetails.name;
                            }
                            if (funcDetails.arguments !== undefined) {
                                if (typeof funcDetails.arguments === 'string') {
                                    try {
                                        JSON.parse(funcDetails.arguments);
                                        toolCall.function.arguments = funcDetails.arguments;
                                    }
                                    catch {
                                        console.warn(`(${this.provider}) Argument string is not valid JSON, wrapping in quotes:`, funcDetails.arguments);
                                        toolCall.function.arguments = JSON.stringify(funcDetails.arguments);
                                    }
                                }
                                else {
                                    toolCall.function.arguments = JSON.stringify(funcDetails.arguments);
                                }
                            }
                        }
                        else if (typeof callData.name === 'string') {
                            toolCall.function.name = callData.name;
                            if (callData.arguments !== undefined) {
                                if (typeof callData.arguments === 'string') {
                                    try {
                                        JSON.parse(callData.arguments);
                                        toolCall.function.arguments = callData.arguments;
                                    }
                                    catch {
                                        console.warn(`(${this.provider}) Argument string is not valid JSON, wrapping in quotes:`, callData.arguments);
                                        toolCall.function.arguments = JSON.stringify(callData.arguments);
                                    }
                                }
                                else {
                                    toolCall.function.arguments = JSON.stringify(callData.arguments);
                                }
                            }
                        }
                        if (toolCall.function.name && toolCall.function.name.length > 0) {
                            validSimulatedCalls.push(toolCall);
                        }
                        else {
                            console.warn(`(${this.provider}) Invalid tool call object, missing name:`, callData);
                        }
                    }
                    else {
                        console.warn(`(${this.provider}) Skipping invalid item in tool call array:`, callData);
                    }
                }
                if (validSimulatedCalls.length > 0) {
                    let textBeforeToolCall = aggregatedContent.substring(0, matchIndex).trim();
                    textBeforeToolCall = textBeforeToolCall.replaceAll(TOOL_CALL_CLEANUP_REGEX, CLEANUP_PLACEHOLDER);
                    const eventsToYield = [];
                    if (textBeforeToolCall) {
                        eventsToYield.push({
                            type: 'message_complete',
                            content: textBeforeToolCall,
                            message_id: messageId,
                        });
                    }
                    for (const validSimulatedCall of validSimulatedCalls) {
                        eventsToYield.push({
                            type: 'tool_start',
                            tool_call: validSimulatedCall,
                        });
                    }
                    return { handled: true, eventsToYield };
                }
                else {
                    console.warn(`(${this.provider}) Last TOOL_CALLS array found but contained no valid tool call objects after processing.`);
                }
            }
            catch (parseError) {
                console.error(`(${this.provider}) Found last TOOL_CALLS pattern, but failed during processing: ${parseError}. JSON String: ${jsonArrayString}`);
            }
        }
        const cleanedContent = aggregatedContent.replaceAll(TOOL_CALL_CLEANUP_REGEX, CLEANUP_PLACEHOLDER);
        return { handled: false, cleanedContent: cleanedContent };
    }
    async *createResponseStream(messages, model, agent, requestId) {
        const { getToolsFromAgent } = await import('../utils/agent.js');
        const toolsPromise = agent ? getToolsFromAgent(agent) : Promise.resolve([]);
        const tools = await toolsPromise;
        const settings = agent?.modelSettings;
        try {
            const chatMessages = await mapMessagesToOpenAI(messages, model);
            if (chatMessages.length === 0) {
                chatMessages.push({
                    role: 'user',
                    content: 'Please begin.',
                });
            }
            let requestParams = {
                model,
                messages: chatMessages,
                stream: true,
            };
            if (settings?.temperature !== undefined)
                requestParams.temperature = settings.temperature;
            if (settings?.top_p !== undefined)
                requestParams.top_p = settings.top_p;
            if (settings?.max_tokens)
                requestParams.max_tokens = settings.max_tokens;
            if (settings?.tool_choice)
                requestParams.tool_choice =
                    settings.tool_choice;
            if (settings?.json_schema) {
                requestParams.response_format = createChatJsonSchemaResponseFormat(settings.json_schema);
            }
            const modelEntry = findModel(model);
            const shouldSimulateTools = modelEntry?.features?.simulate_tools === true;
            const supportsNativeTools = modelEntry?.features?.tool_use === true && !shouldSimulateTools;
            if (tools && tools.length > 0) {
                if (supportsNativeTools) {
                    requestParams.tools = await convertToOpenAITools(tools);
                }
                else if (shouldSimulateTools) {
                    const openAITools = await convertToOpenAITools(tools);
                    const toolInfoForPrompt = formatToolsForPrompt(openAITools);
                    const messages = [...requestParams.messages];
                    messages.push({ role: 'system', content: toolInfoForPrompt });
                    requestParams.messages = messages;
                    requestParams.tools = undefined;
                }
                else {
                    console.warn(`(${this.provider}) Model '${model}' doesn't support tool calling. Tools will be ignored.`);
                    requestParams.tools = undefined;
                }
            }
            const overrideParams = { ...this.commonParams };
            const REASONING_EFFORT_CONFIGS = [
                { suffix: 'none', effort: 'none' },
                { suffix: 'disabled', effort: 'none' },
                { suffix: 'minimal', effort: 'minimal' },
                { suffix: 'low', effort: 'low' },
                { suffix: 'medium', effort: 'medium' },
                { suffix: 'high', effort: 'high' },
                { suffix: 'xhigh', effort: 'xhigh' },
            ];
            const parseThinkingBudget = (value) => {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return null;
                }
                return Math.max(0, Math.floor(value));
            };
            const mapThinkingBudgetToReasoningEffort = (budget) => {
                if (budget === 0)
                    return undefined;
                if (budget <= 2048)
                    return 'low';
                if (budget <= 16384)
                    return 'medium';
                return 'high';
            };
            const thinkingBudgetFromSettings = parseThinkingBudget(settings?.thinking_budget);
            const thinkingBudgetEffort = thinkingBudgetFromSettings !== null
                ? mapThinkingBudgetToReasoningEffort(thinkingBudgetFromSettings)
                : undefined;
            for (const config of REASONING_EFFORT_CONFIGS) {
                const suffix = `-${config.suffix}`;
                if (model.endsWith(suffix)) {
                    overrideParams.reasoning = {
                        effort: config.effort,
                    };
                    model = model.slice(0, -suffix.length);
                    requestParams.model = model;
                    break;
                }
            }
            if (thinkingBudgetEffort !== undefined) {
                overrideParams.reasoning = {
                    effort: thinkingBudgetEffort,
                };
            }
            requestParams = {
                ...requestParams,
                ...overrideParams,
            };
            requestParams = this.prepareParameters(requestParams);
            const loggedRequestId = log_llm_request(agent.agent_id, this.provider, model, requestParams, new Date(), requestId, agent.tags);
            requestId = loggedRequestId;
            const { waitWhilePaused } = await import('../utils/pause_controller.js');
            await waitWhilePaused(100, agent.abortSignal);
            const stream = await this.client.chat.completions.create(requestParams, {
                signal: agent.abortSignal,
            });
            let aggregatedContent = '';
            let aggregatedThinking = '';
            const messageId = uuidv4();
            let messageIndex = 0;
            const partialToolCallsByIndex = new Map();
            let finishReason = null;
            let usage = undefined;
            const citationTracker = createCitationTracker();
            const chunks = [];
            try {
                const deltaBuffers = new Map();
                for await (const chunk of stream) {
                    chunks.push(chunk);
                    if (isPaused()) {
                        await waitWhilePaused(100, agent.abortSignal);
                    }
                    const choice = chunk.choices[0];
                    if (!choice?.delta)
                        continue;
                    const delta = choice.delta;
                    if (delta.content) {
                        aggregatedContent += delta.content;
                        for (const ev of bufferDelta(deltaBuffers, messageId, delta.content, content => ({
                            type: 'message_delta',
                            content,
                            message_id: messageId,
                            order: messageIndex++,
                        }))) {
                            yield ev;
                        }
                    }
                    const extendedDelta = delta;
                    if (extendedDelta.reasoning) {
                        aggregatedThinking += extendedDelta.reasoning;
                        for (const ev of bufferDelta(deltaBuffers, messageId, extendedDelta.reasoning, content => ({
                            type: 'message_delta',
                            content: '',
                            message_id: messageId,
                            thinking_content: content,
                            order: messageIndex++,
                        }))) {
                            yield ev;
                        }
                    }
                    if (Array.isArray(extendedDelta.annotations)) {
                        for (const ann of extendedDelta.annotations) {
                            if (ann.type === 'url_citation' && ann.url_citation?.url) {
                                const marker = formatCitation(citationTracker, {
                                    title: ann.url_citation.title || ann.url_citation.url,
                                    url: ann.url_citation.url,
                                });
                                aggregatedContent += marker;
                                yield {
                                    type: 'message_delta',
                                    content: marker,
                                    message_id: messageId,
                                    order: messageIndex++,
                                };
                            }
                        }
                    }
                    const extendedChunk = chunk;
                    if (Array.isArray(extendedChunk.citations) && extendedChunk.citations.length > 0) {
                        for (const url of extendedChunk.citations) {
                            if (typeof url === 'string' && !citationTracker.citations.has(url)) {
                                const title = url.split('/').pop() || url;
                                const marker = formatCitation(citationTracker, {
                                    title,
                                    url,
                                });
                                if (marker) {
                                    aggregatedContent += marker;
                                    yield {
                                        type: 'message_delta',
                                        content: marker,
                                        message_id: messageId,
                                        order: messageIndex++,
                                    };
                                }
                            }
                        }
                    }
                    if ('reasoning_content' in delta) {
                        const thinking_content = delta.reasoning_content;
                        if (thinking_content) {
                            if (model.startsWith('grok-') && thinking_content === 'Thinking... ') {
                                continue;
                            }
                            aggregatedThinking += thinking_content;
                            yield {
                                type: 'message_delta',
                                content: '',
                                message_id: messageId,
                                thinking_content,
                                order: messageIndex++,
                            };
                        }
                    }
                    if ('thinking_content' in delta) {
                        const thinking_content = delta.thinking_content;
                        if (thinking_content) {
                            aggregatedThinking += thinking_content;
                            yield {
                                type: 'message_delta',
                                content: '',
                                message_id: messageId,
                                thinking_content,
                                order: messageIndex++,
                            };
                        }
                    }
                    if (delta.tool_calls) {
                        for (const toolCallDelta of delta.tool_calls) {
                            const typedDelta = toolCallDelta;
                            const index = typedDelta.index;
                            if (typeof index !== 'number')
                                continue;
                            let partialCall = partialToolCallsByIndex.get(index);
                            if (!partialCall) {
                                partialCall = {
                                    id: typedDelta.id || '',
                                    type: 'function',
                                    function: {
                                        name: typedDelta.function?.name || '',
                                        arguments: typedDelta.function?.arguments || '',
                                    },
                                };
                                partialToolCallsByIndex.set(index, partialCall);
                            }
                            else {
                                if (typedDelta.id)
                                    partialCall.id = typedDelta.id;
                                if (typedDelta.function?.name)
                                    partialCall.function.name = typedDelta.function.name;
                                if (typedDelta.function?.arguments) {
                                    const newArgs = typedDelta.function.arguments;
                                    const accumulatedArgs = partialCall.function.arguments + newArgs;
                                    try {
                                        JSON.parse(accumulatedArgs);
                                        partialCall.function.arguments = accumulatedArgs;
                                    }
                                    catch {
                                        partialCall.function.arguments = accumulatedArgs;
                                    }
                                }
                            }
                        }
                    }
                    if (choice.finish_reason)
                        finishReason = choice.finish_reason;
                    if (chunk.usage)
                        usage = chunk.usage;
                }
                if (citationTracker.citations.size > 0) {
                    const footnotes = generateFootnotes(citationTracker);
                    aggregatedContent += footnotes;
                    yield {
                        type: 'message_delta',
                        content: footnotes,
                        message_id: messageId,
                        order: messageIndex++,
                    };
                }
                if (usage) {
                    const calculatedUsage = costTracker.addUsage(normalizeOpenAIChatUsage(model, usage));
                    if (!hasEventHandler()) {
                        yield {
                            type: 'cost_update',
                            usage: calculatedUsage,
                        };
                    }
                }
                else {
                    let inputText = '';
                    for (const msg of chatMessages) {
                        if (typeof msg.content === 'string') {
                            inputText += msg.content + '\n';
                        }
                        else if (Array.isArray(msg.content)) {
                            for (const part of msg.content) {
                                if ('text' in part && typeof part.text === 'string') {
                                    inputText += part.text + '\n';
                                }
                            }
                        }
                    }
                    const { CostTracker } = await import('../utils/cost_tracker.js');
                    const estimatedInputTokens = CostTracker.estimateTokens(inputText);
                    const estimatedOutputTokens = CostTracker.estimateTokens(aggregatedContent);
                    const calculatedUsage = costTracker.addEstimatedUsage(model, inputText, aggregatedContent, {
                        provider: this.provider,
                    });
                    if (!hasEventHandler()) {
                        yield {
                            type: 'cost_update',
                            usage: {
                                ...calculatedUsage,
                                total_tokens: estimatedInputTokens + estimatedOutputTokens,
                            },
                        };
                    }
                }
                for (const ev of flushBufferedDeltas(deltaBuffers, (id, content) => ({
                    type: 'message_delta',
                    content,
                    message_id: id,
                    order: messageIndex++,
                }))) {
                    yield ev;
                }
                if (finishReason === 'stop') {
                    const parseResult = this._parseAndPrepareSimulatedToolCalls(aggregatedContent, messageId);
                    if (parseResult.handled && parseResult.eventsToYield) {
                        for (const event of parseResult.eventsToYield) {
                            yield event;
                        }
                    }
                    else {
                        yield {
                            type: 'message_complete',
                            content: parseResult.cleanedContent ?? '',
                            message_id: messageId,
                            thinking_content: aggregatedThinking,
                        };
                    }
                }
                else if (finishReason === 'tool_calls') {
                    const completedToolCalls = Array.from(partialToolCallsByIndex.values()).filter(call => call.id && call.function.name);
                    const validatedToolCalls = [];
                    const malformedToolCallNames = [];
                    if (completedToolCalls.length > 0) {
                        for (const completedToolCall of completedToolCalls) {
                            let toolCallMalformed = false;
                            if (completedToolCall.function.arguments) {
                                try {
                                    const parsed = JSON.parse(completedToolCall.function.arguments);
                                    completedToolCall.function.arguments = JSON.stringify(parsed);
                                }
                                catch (error) {
                                    console.warn(`(${this.provider}) Invalid JSON in tool arguments for ${completedToolCall.function.name}, attempting to fix: ${error}`);
                                    const argStr = completedToolCall.function.arguments;
                                    const matches = argStr.match(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/);
                                    if (matches && matches[0]) {
                                        try {
                                            const parsed = JSON.parse(matches[0]);
                                            completedToolCall.function.arguments = JSON.stringify(parsed);
                                        }
                                        catch {
                                            toolCallMalformed = true;
                                            console.error(`(${this.provider}) Could not parse tool arguments.`);
                                        }
                                    }
                                    else {
                                        toolCallMalformed = true;
                                    }
                                }
                            }
                            if (toolCallMalformed) {
                                malformedToolCallNames.push(completedToolCall.function.name);
                                continue;
                            }
                            validatedToolCalls.push(completedToolCall);
                        }
                        if (malformedToolCallNames.length > 0) {
                            const malformedToolCallError = malformedToolCallNames.length === 1
                                ? `Error (${this.provider}): Model emitted malformed tool arguments for ${malformedToolCallNames[0]}.`
                                : `Error (${this.provider}): Model emitted malformed tool arguments for ${malformedToolCallNames.join(', ')}.`;
                            log_llm_error(requestId, malformedToolCallError);
                            yield {
                                type: 'error',
                                error: malformedToolCallError,
                                recoverable: false,
                            };
                        }
                        else {
                            for (const completedToolCall of validatedToolCalls) {
                                if (aggregatedThinking) {
                                    completedToolCall.reasoning_content = aggregatedThinking;
                                }
                                yield {
                                    type: 'tool_start',
                                    tool_call: completedToolCall,
                                };
                            }
                        }
                    }
                    else {
                        log_llm_error(requestId, `Error (${this.provider}): Model indicated tool calls, but none were parsed correctly.`);
                        console.warn(`(${this.provider}) Finish reason 'tool_calls', but no complete native tool calls parsed.`);
                        yield {
                            type: 'error',
                            error: `Error (${this.provider}): Model indicated tool calls, but none were parsed correctly.`,
                            recoverable: false,
                        };
                    }
                }
                else if (finishReason === 'length') {
                    const cleanedPartialContent = aggregatedContent.replaceAll(TOOL_CALL_CLEANUP_REGEX, CLEANUP_PLACEHOLDER);
                    log_llm_error(requestId, `Error (${this.provider}): Response truncated (max_tokens). Partial: ${cleanedPartialContent.substring(0, 100)}...`);
                    yield {
                        type: 'error',
                        error: `Error (${this.provider}): Response truncated (max_tokens). Partial: ${cleanedPartialContent.substring(0, 100)}...`,
                        recoverable: false,
                    };
                }
                else if (finishReason) {
                    const cleanedReasonContent = aggregatedContent.replaceAll(TOOL_CALL_CLEANUP_REGEX, CLEANUP_PLACEHOLDER);
                    log_llm_error(requestId, `Error (${this.provider}): Response stopped due to: ${finishReason}. Content: ${cleanedReasonContent.substring(0, 100)}...`);
                    yield {
                        type: 'error',
                        error: `Error (${this.provider}): Response stopped due to: ${finishReason}. Content: ${cleanedReasonContent.substring(0, 100)}...`,
                        recoverable: false,
                    };
                }
                else {
                    if (aggregatedContent) {
                        console.warn(`(${this.provider}) Stream finished without finish_reason, yielding cleaned content.`);
                        const parseResult = this._parseAndPrepareSimulatedToolCalls(aggregatedContent, messageId);
                        if (parseResult.handled && parseResult.eventsToYield) {
                            for (const event of parseResult.eventsToYield) {
                                yield event;
                            }
                        }
                        else {
                            yield {
                                type: 'message_complete',
                                content: parseResult.cleanedContent ?? '',
                                message_id: messageId,
                                thinking_content: aggregatedThinking,
                            };
                        }
                    }
                    else if (partialToolCallsByIndex.size > 0) {
                        log_llm_error(requestId, `Error (${this.provider}): Stream ended unexpectedly during native tool call generation.`);
                        console.warn(`(${this.provider}) Stream finished without finish_reason during native tool call generation.`);
                        yield {
                            type: 'error',
                            error: `Error (${this.provider}): Stream ended unexpectedly during native tool call generation.`,
                            recoverable: false,
                        };
                    }
                    else {
                        log_llm_error(requestId, `Error (${this.provider}): Stream finished unexpectedly empty.`);
                        console.warn(`(${this.provider}) Stream finished empty without reason, content, or tool calls.`);
                        yield {
                            type: 'error',
                            error: `Error (${this.provider}): Stream finished unexpectedly empty.`,
                            recoverable: false,
                        };
                    }
                }
            }
            catch (streamError) {
                log_llm_error(requestId, streamError);
                console.error(`(${this.provider}) Error processing chat completions stream:`, streamError);
                yield createProviderErrorEvent(streamError, {
                    prefix: `Stream processing error (${this.provider} ${model}): `,
                    request_id: requestId,
                    reason: 'request_stream_failed',
                    details: streamError instanceof OpenAI.APIError || streamError instanceof APIError
                        ? streamError.error
                        : undefined,
                    retryableErrors: agent.retryOptions?.additionalRetryableErrors,
                    retryableStatusCodes: agent.retryOptions?.additionalRetryableStatusCodes,
                });
            }
            finally {
                partialToolCallsByIndex.clear();
                log_llm_response(requestId, chunks);
            }
        }
        catch (error) {
            log_llm_error(requestId, error);
            console.error(`Error running ${this.provider} chat completions stream:`, error);
            yield createProviderErrorEvent(error, {
                prefix: `API Error (${this.provider} - ${model}): `,
                request_id: requestId,
                reason: 'request_setup_failed',
                details: error instanceof OpenAI.APIError || error instanceof APIError ? error.error : undefined,
                retryableErrors: agent.retryOptions?.additionalRetryableErrors,
                retryableStatusCodes: agent.retryOptions?.additionalRetryableStatusCodes,
            });
        }
    }
}
