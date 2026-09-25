

import {
    alternativesSuggestionsSchema,
    primarySuggestionSchema,
    suggestionsSchema,
} from './schema.js';
import { validateEvidenceIds } from './packet.js';
import { createPrimaryToolEvidenceCollector } from './passEvidence.js';

const USAGE_KEYS = [
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'cached_tokens',
    'cache_write_tokens',
    'cache_write_1h_tokens',
    'reasoning_tokens',
];

const uniqueStrings = values => Array.from(new Set((values || []).filter(value => typeof value === 'string' && value.trim())));

const responseFingerprint = response => String(response?.response || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const assertDistinctResponses = responses => {
    const seen = new Set();
    for (const response of responses || []) {
        const fingerprint = responseFingerprint(response);
        if (seen.has(fingerprint)) {
            throw new Error('Alternative suggestions must not repeat the primary or another alternative.');
        }
        seen.add(fingerprint);
    }
};

const mergeSuggestions = ({ primary, alternatives }) => {
    const responses = [...primary.responses, ...alternatives.alternatives];
    assertDistinctResponses(responses);

    return suggestionsSchema().parse({
        user_goal: primary.user_goal,
        responses,
        missing_information: uniqueStrings([
            ...(primary.missing_information || []),
            ...(alternatives.missing_information || []),
        ]),
    });
};

const aggregateUsage = ({ usages, startedAt, firstTokenMs }) => {
    const complete = usages.filter(Boolean);
    const models = Array.from(new Set(complete.map(item => item.usage?.model).filter(Boolean)));
    const allKnown = complete.length > 0 && complete.every(item => (
        !item.usage?.cost_unknown && typeof item.usage?.cost === 'number'
    ));
    const totals = Object.fromEntries(USAGE_KEYS.map(key => [
        key,
        complete.reduce((total, item) => total + (Number(item.usage?.[key]) || 0), 0),
    ]));
    const errors = uniqueStrings(complete.map(item => item.usage?.error || item.usage?.telemetry_error));

    return {
        model: models.length === 1 ? models[0] : models.length > 1 ? 'ensemble' : 'unknown',
        cost: allKnown ? complete.reduce((total, item) => total + item.usage.cost, 0) : null,
        cost_unknown: !allKnown,
        telemetry_error: errors[0] || (complete.length === 0 ? 'No provider usage events were received.' : null),
        ...totals,
        metadata: {
            models,
            task: 'agent_suggestions_two_pass',
            stages: complete.map(item => item.stage),
        },
        latency_ms: Date.now() - startedAt,
        first_token_ms: firstTokenMs,
        rounds: complete.flatMap(item => (item.usage?.rounds || []).map(round => ({ ...round, assist_stage: item.stage }))),
        error: errors[0] || null,
    };
};

const createTwoPassTrace = trace => {
    const startedAt = Date.now();
    const usages = [];
    let firstTokenMs = null;

    const notify = (name, value) => {
        if (typeof trace?.[name] === 'function') return trace[name](value);
    };

    return {
        forStage(stage, evidenceCollector = null) {
            return {
                onEvent: event => notify('onEvent', {...event, assist_stage:stage}),
                onToolCall: event => {
                    if (evidenceCollector) evidenceCollector.record(event);
                    notify('onToolCall', { ...event, assist_stage: stage });
                },
                onFirstToken: () => {
                    if (firstTokenMs !== null) return;
                    firstTokenMs = Date.now() - startedAt;
                    notify('onFirstToken', firstTokenMs);
                },
                onThinking: value => notify('onThinking', value && typeof value === 'object'
                    ? { ...value, assist_stage: stage }
                    : value),
                onRequestMessages: value => notify('onRequestMessages', value),
                onUsage: usage => {
                    usages.push({ stage, usage });
                    return notify('onUsage', aggregateUsage({ usages, startedAt, firstTokenMs }));
                },
            };
        },
    };
};

const throwIfAborted = signal => {
    if (!signal?.aborted) return;
    if (typeof signal.throwIfAborted === 'function') signal.throwIfAborted();
    throw signal.reason || new Error('Suggestion generation was aborted.');
};

const generateTwoPassSuggestions = async ({ context, buildMessages, runPass }) => {
    const trace = createTwoPassTrace(context.options?.trace);
    const primaryEvidence = createPrimaryToolEvidenceCollector();
    const primary = primarySuggestionSchema().parse(await runPass({
        stage: 'primary',
        messages: buildMessages({ stage: 'primary' }),
        schema: primarySuggestionSchema(),
        responseName: 'agent_suggestion_primary',
        trace: trace.forStage('primary', primaryEvidence),
    }));
    validateEvidenceIds(primary, context.assist.evidenceIds);

    const primaryToolEvidence = primaryEvidence.snapshot();
    // Providers can finish a request after the lifecycle deadline fires. Do not
    // begin a second provider request after that shared deadline has elapsed.
    throwIfAborted(context.options?.abortSignal);
    const alternatives = alternativesSuggestionsSchema().parse(await runPass({
        stage: 'alternatives',
        messages: buildMessages({
            stage: 'alternatives',
            primary,
            primaryToolEvidence,
        }),
        schema: alternativesSuggestionsSchema(),
        responseName: 'agent_suggestion_alternatives',
        trace: trace.forStage('alternatives'),
    }));
    validateEvidenceIds({ responses: alternatives.alternatives }, context.assist.evidenceIds);

    return mergeSuggestions({ primary, alternatives });
};

export {
    aggregateUsage,
    createTwoPassTrace,
    generateTwoPassSuggestions,
    mergeSuggestions,
    throwIfAborted,
};
