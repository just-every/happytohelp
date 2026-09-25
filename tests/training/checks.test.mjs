'use strict';

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadFixture, validateFixture } from './fixture.cjs';
import { evaluateSuggestion, extractResponses, fixtureEvidenceId } from '../../src/modules/training-runs/checks/index.mjs';

test('synthetic evaluation fixture is valid and contains the required corpus cases', () => {
    const { value } = loadFixture();
    assert.deepEqual(validateFixture(value), []);
    assert.equal(value.cases.length, 16);
    assert.ok(value.cases.some((item) => item.id === 'policy_beyond_130_files'));
    assert.ok(value.cases.some((item) => item.id === 'other_workspace_permission'));
    assert.ok(value.cases.some((item) => item.id === 'ready_not_draft_index'));
});

test('checker evaluates response cardinality, private-text leakage, and evidence IDs', () => {
    const caseDefinition = {
        expected: {
            min_responses: 1,
            max_responses: 2,
            must_include_any: ['refund'],
            must_not_include: ['private-marker'],
            required_evidence_ids: ['refund-completed'],
            forbidden_evidence_ids: ['other-workspace-policy'],
        },
    };
    const result = {
        variant: 'prototype',
        output: { responses: [{ response: 'The refund is complete.', evidence_ids: [fixtureEvidenceId('refund-completed')] }] },
    };
    assert.deepEqual(extractResponses(result.output), ['The refund is complete.']);
    assert.equal(evaluateSuggestion(caseDefinition, result).passed, true);

    const leaked = evaluateSuggestion(caseDefinition, {
        variant: 'prototype',
        output: { responses: [{ response: 'private-marker refund' }, { response: 'another refund' }, { response: 'third refund' }] },
        evidence_ids: [fixtureEvidenceId('other-workspace-policy')],
    });
    assert.equal(leaked.passed, false);
    assert.deepEqual(leaked.failures.map((failure) => failure.check), [
        'response_cardinality',
        'must_not_include_per_reply',
        'required_evidence_ids_per_reply',
        'required_evidence_ids_per_reply',
        'required_evidence_ids_per_reply',
        'forbidden_evidence_ids',
    ]);
});

test('history evidence uses the seeded message ID and accepts either scoped history tool', () => {
    const olderFact = fixtureEvidenceId('message:long_thread_older_fact/0');
    const check = evaluateSuggestion({
        expected: {
            required_evidence_ids: ['message:long_thread_older_fact/0'],
            required_tool_names_any: ['search_conversation_history', 'read_conversation_history'],
        },
    }, {
        variant: 'prototype',
        toolCalls: [{ name: 'search_conversation_history' }],
        output: { responses: [{ response: 'The warehouse audit ended and the carrier scan is pending.', evidence_ids: [olderFact] }] },
    });
    assert.equal(check.passed, true);
});

test('checker evaluates each card independently and keeps comparator format deltas separate', () => {
    const perCard = evaluateSuggestion({
        expected: { must_include_all: ['pause', 'address'] },
    }, {
        variant: 'prototype',
        output: { responses: [
            { response: 'You can pause one cycle or change the delivery address.' },
            { response: 'You can pause one cycle.' },
        ] },
    });
    assert.equal(perCard.passed, false);
    assert.deepEqual(perCard.quality_failures, [{
        check: 'must_include_all_per_reply', response_index: 1, expected: ['address'],
    }]);

    const harnessOnly = evaluateSuggestion({
        expected: { min_responses: 1, max_responses: 2, cardinality_classification: 'harness' },
    }, {
        variant: 'legacy-ui',
        output: { responses: [{ response: 'One.' }, { response: 'Two.' }, { response: 'Three.' }] },
    });
    assert.equal(harnessOnly.passed, true);
    assert.equal(harnessOnly.harness_failures[0].check, 'response_cardinality');
});
