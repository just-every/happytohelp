
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTaskCost, taskModelSettings } from '../../src/modules/ai-support/llm/taskModels.js';

test('background model settings avoid provider default high reasoning', () => {
    assert.equal(taskModelSettings('gpt-5.6-luna', 'analysis').thinking_budget, 4096);
    assert.equal(taskModelSettings('gpt-5.6-luna', 'user_reply').thinking_budget, 4096);
    assert.equal(taskModelSettings('gemini-3.8-flash', 'analysis').thinking_level, 'LOW');
    assert.equal(taskModelSettings('deepseek-v4-flash', 'analysis').thinking_budget, 0);
});

test('background incumbent usage is billable and DeepSeek cost follows request time', () => {
    const usage = { input_tokens: 1000000, output_tokens: 1000000, cached_tokens: 100000 };
    assert.equal(calculateTaskCost('gpt-5.4-nano', usage), 1.432);
    assert.equal(calculateTaskCost('deepseek-v4-flash', usage, '2026-09-08T01:00:00Z'), 1.7174);
    assert.equal(calculateTaskCost('deepseek-v4-flash', usage, '2026-09-08T04:00:00Z'), 0.8587);
    assert.equal(calculateTaskCost('deepseek-v4-flash', usage, '2026-09-12T01:00:00Z'), 0.8587);
    assert.equal(calculateTaskCost('not-in-catalogue', usage), null);
});
