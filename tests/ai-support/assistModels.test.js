

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProviderContract, assistProvider } from '../../src/modules/ai-support/assist/providerContract.js';
import { calculateAssistCost, getAssistModelSettings } from '../../src/modules/ai-support/assist/models.js';
import { COMMON_REPLY_ICONS, replyIconTool } from '../../src/modules/ai-support/assist/icons.js';
import { replyIconNames } from '../../src/modules/ai-support/llm/schemas/reply-icons.js';

test('every icon example in the model instructions belongs to the real catalogue', () => {
    assert.deepEqual(COMMON_REPLY_ICONS.filter(name => !replyIconNames.has(name)), []);
});

test('one catalogue lookup supplies real icons and retires only that generation lookup', async () => {
    const tool = replyIconTool();
    const otherRequest = replyIconTool();
    assert.equal(tool.isAvailable(), true);
    const result = JSON.parse(await tool.function('discount percent'));
    assert.ok(result.icons.includes('percent'));
    assert.equal(result.lookup_complete, true);
    assert.equal(tool.isAvailable(), false);
    assert.equal(otherRequest.isAvailable(), true);
    assert.ok([...result.icons, ...result.other_allowed_icons].every(name => replyIconNames.has(name)));
});

test('standard prices include cache writes and do not double-charge reasoning output', () => {
    const usage = { input_tokens: 1000, cached_tokens: 200, cache_write_tokens: 100, output_tokens: 300, reasoning_tokens: 200 };
    assert.equal(calculateAssistCost('gpt-5.6-sol', usage), (700 * 4 + 200 * 0.4 + 100 * 5 + 300 * 20) / 1e6);
    assert.equal(calculateAssistCost('claude-fable-5-1', { input_tokens: 1000, cached_tokens: 1000, output_tokens: 0 }), 0.00025);
    assert.throws(() => calculateAssistCost('gpt-5.6-sol', { input_tokens: 1, cached_tokens: 2 }), /exceed/);
    assert.equal(calculateAssistCost('unknown', usage), null);
});

test('long-context rates depend on each request input length', () => {
    assert.equal(calculateAssistCost('gpt-5.6-luna', { input_tokens: 300000, output_tokens: 1000 }), 0.1218);
});

test('modern OpenAI uses output budget and supported reasoning parameters without sampling', () => {
    const result = applyProviderContract({ model: 'gpt-6-astra', temperature: 1, top_p: 1, reasoning: { effort: 'medium' } }, 'gpt-6-astra', getAssistModelSettings('gpt-6-astra'));
    assert.equal(result.model, 'gpt-6-astra');
    assert.equal(result.max_output_tokens, 12000);
    assert.equal(result.temperature, undefined);
    assert.deepEqual(result.reasoning, { effort: 'medium' });
});

test('Claude sends native structured output and adaptive reasoning with unchanged model identity', () => {
    const result = applyProviderContract({ model: 'claude-fable-5-1', thinking: { type: 'enabled', budget_tokens: 8192 }, temperature: 1 }, 'claude-fable-5-1', {
        thinking_budget: 8192,
        json_schema: { schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', minLength: 1 } }, required: ['text'] } },
    });
    assert.equal(result.model, 'claude-fable-5-1');
    assert.deepEqual(result.thinking, { type: 'adaptive' });
    assert.equal(result.output_config.effort, 'medium');
    assert.equal(result.output_config.format.type, 'json_schema');
    assert.equal(result.output_config.format.schema.properties.text.minLength, undefined);
    assert.equal(result.temperature, undefined);
});

test('simultaneous provider requests retain their own schema, budget and abort signal', async () => {
    const calls = [];
    const provider = {
        client: { messages: { create: async (params, options) => { calls.push({ params, options }); return params; } } },
        async *createResponseStream(messages, model, agent) {
            await Promise.resolve();
            yield await this.client.messages.create({ model }, { signal: agent.abortSignal });
        },
    };
    const wrapper = assistProvider(provider);
    const signals = [new AbortController().signal, new AbortController().signal];
    await Promise.all(['claude-opus-5', 'claude-fable-5-1'].map(async (model, index) => {
        for await (const _ of wrapper.createResponseStream([], model, { abortSignal: signals[index], modelSettings: { thinking_budget: index ? 8192 : 2048 } })) { /* consume */ }
    }));
    assert.deepEqual(calls.map(call => call.params.output_config.effort), ['low', 'medium']);
    assert.equal(calls[0].options.signal, signals[0]);
    assert.equal(calls[1].options.signal, signals[1]);
    assert.equal(provider.client.messages.create.name, 'create');
});

test('Claude tool arguments use a native strict contract without mutating other requests', () => {
    const tool = { name: 'search_history', input_schema: { type: 'object', properties: { before: { type: 'string' }, limit: { type: 'integer', maximum: 80 } }, required: ['before', 'limit'] } };
    const params = { tools: [tool] };
    const result = applyProviderContract(params, 'claude-sonnet-5');
    assert.equal(result.tools[0].strict, true);
    assert.equal(result.tools[0].input_schema.additionalProperties, false);
    assert.deepEqual(result.tools[0].input_schema.required, ['before', 'limit']);
    assert.equal(result.tools[0].input_schema.properties.limit.maximum, undefined);
    assert.equal(tool.strict, undefined);
    assert.equal(applyProviderContract(params, 'gemini-3.8-flash'), params);
});
