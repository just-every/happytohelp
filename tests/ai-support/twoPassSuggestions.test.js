

import assert from 'node:assert/strict';
import test from 'node:test';

import { generateTwoPassSuggestions } from '../../src/modules/ai-support/assist/twoPassSuggestions.js';

const primaryResult = {
    user_goal: 'Find out whether a renewal can be cancelled.',
    responses: [{
        button: 'Cancellation policy',
        icon: 'circle-question-mark',
        response: 'Your renewal can be cancelled before the invoice is issued.',
        use_when: '',
        evidence_ids: ['message:1', 'knowledge:renewal-policy'],
    }],
    missing_information: [],
};

const alternativesResult = {
    alternatives: [{
        button: 'Offer cancellation',
        icon: 'circle-check',
        response: 'I can arrange the cancellation for you if you would like me to proceed.',
        use_when: '',
        evidence_ids: ['message:1', 'knowledge:renewal-policy'],
    }, {
        button: 'After cancelling',
        icon: 'calendar-check',
        response: 'Your cancellation is scheduled for the end of the current term.',
        use_when: 'after the operator verifies the renewal invoice has not been issued and successfully schedules cancellation for the end of the current term',
        evidence_ids: ['message:1', 'knowledge:renewal-policy'],
    }],
    missing_information: [],
};

const createContext = (trace = {}) => ({
    options: { trace },
    assist: { evidenceIds: new Set(['message:1', 'knowledge:renewal-policy']) },
});

const firstPassToolEvent = {
    type: 'tool_done',
    tool_call: { call_id: 'knowledge-call-1', function: { name: 'read_knowledge_source' } },
    result: {
        call_id: 'knowledge-call-1',
        output: JSON.stringify({ evidence_id: 'knowledge:renewal-policy', content: 'Cancellations are permitted before an invoice is issued.' }),
    },
};

const usage = stage => ({
    model: 'luna',
    input_tokens: stage === 'primary' ? 120 : 90,
    output_tokens: stage === 'primary' ? 40 : 35,
    total_tokens: stage === 'primary' ? 160 : 125,
    cached_tokens: 0,
    cost: stage === 'primary' ? 0.001 : 0.002,
    cost_unknown: false,
    rounds: [{ request_id: `${stage}-request` }],
});

test('two-pass suggestions preserve raw first-pass evidence and aggregate usage atomically', async () => {
    const usageEvents = [];
    const toolEvents = [];
    const capturedPasses = [];
    const context = createContext({
        onUsage: event => usageEvents.push(event),
        onToolCall: event => toolEvents.push(event),
    });
    const result = await generateTwoPassSuggestions({
        context,
        buildMessages: pass => {
            capturedPasses.push(pass);
            return [{ role: 'user', content: JSON.stringify(pass) }];
        },
        runPass: async pass => {
            if (pass.stage === 'primary') {
                pass.trace.onToolCall(firstPassToolEvent);
                pass.trace.onFirstToken();
                pass.trace.onUsage(usage('primary'));
                return primaryResult;
            }
            pass.trace.onUsage(usage('alternatives'));
            return alternativesResult;
        },
    });

    assert.equal(result.responses.length, 3);
    assert.equal(result.responses[0].use_when, '');
    assert.equal(result.responses[2].button, 'After cancelling');
    assert.equal(capturedPasses[1].primaryToolEvidence.outputs.length, 1);
    assert.equal(capturedPasses[1].primaryToolEvidence.outputs[0].output, firstPassToolEvent.result.output);
    assert.equal(toolEvents[0].assist_stage, 'primary');
    assert.equal(usageEvents.length, 2);
    assert.equal(usageEvents.at(-1).input_tokens, 210);
    assert.equal(usageEvents.at(-1).output_tokens, 75);
    assert.deepEqual(usageEvents.at(-1).metadata.stages, ['primary', 'alternatives']);
    assert.equal(usageEvents.at(-1).rounds[1].assist_stage, 'alternatives');
});

test('two-pass suggestions do not return a primary result when alternatives fail', async () => {
    const context = createContext();
    let alternativesStarted = false;

    await assert.rejects(generateTwoPassSuggestions({
        context,
        buildMessages: pass => [pass],
        runPass: async pass => {
            if (pass.stage === 'primary') return primaryResult;
            alternativesStarted = true;
            throw new Error('Alternatives provider failed.');
        },
    }), /Alternatives provider failed/);

    assert.equal(alternativesStarted, true);
});

test('two-pass suggestions do not begin alternatives after the shared deadline aborts', async () => {
    const abortController = new AbortController();
    const context = createContext();
    context.options.abortSignal = abortController.signal;
    let alternativesStarted = false;

    await assert.rejects(generateTwoPassSuggestions({
        context,
        buildMessages: pass => [pass],
        runPass: async pass => {
            if (pass.stage === 'primary') {
                abortController.abort(new Error('Suggestion generation timed out.'));
                return primaryResult;
            }
            alternativesStarted = true;
            return alternativesResult;
        },
    }), /Suggestion generation timed out/);

    assert.equal(alternativesStarted, false);
});

test('two-pass suggestions reject a repeated alternative instead of quietly returning duplicate cards', async () => {
    await assert.rejects(generateTwoPassSuggestions({
        context: createContext(),
        buildMessages: pass => [pass],
        runPass: async pass => pass.stage === 'primary' ? primaryResult : {
            ...alternativesResult,
            alternatives: [{ ...primaryResult.responses[0] }],
        },
    }), /must not repeat/);
});
