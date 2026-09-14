'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createBlindReview } = require('../../scripts/eval/blind-review');
const { loadFixture } = require('../../scripts/eval/fixture');

test('blind review removes model and implementation metadata from qualitative candidates', () => {
    const { value } = loadFixture();
    const review = createBlindReview({
        fixture: value,
        seed: 'stable-test-seed',
        records: [{
            kind: 'happytohelp-suggestion-evaluation-run',
            case_id: 'completed_refund_note',
            variant: 'prototype',
            requested_model: 'gpt-5.6-sol',
            usage: { cost: 12 },
            checks: { passed: true },
            output: { responses: [{ button: 'Confirm', icon: 'CircleCheck', response: 'Your refund was completed.' }] },
        }],
    });
    assert.equal(review.candidate_count, 1);
    const candidate = review.candidates[0];
    assert.equal(candidate.candidate_id, 'candidate-0001');
    assert.deepEqual(candidate.responses, [{ reply_id: 1, title: 'Confirm', icon: 'CircleCheck', response: 'Your refund was completed.' }]);
    assert.equal(JSON.stringify(candidate).includes('gpt-5.6-sol'), false);
    assert.equal(JSON.stringify(candidate).includes('prototype'), false);
});
