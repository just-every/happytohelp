'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { loadFixture } = require('../../scripts/eval/fixture');
const { DEFAULT_PROTOTYPE_MODELS, parseArgs, planRuns } = require('../../scripts/eval/run');

test('evaluation runner defaults to one committed baseline and every prototype model per case', () => {
    const { value } = loadFixture();
    const planned = planRuns({ fixture: value, args: parseArgs(['--limit-cases', '1']) });
    assert.equal(planned.length, DEFAULT_PROTOTYPE_MODELS.length + 1);
    assert.deepEqual(planned.map(item => item.variant), ['baseline', ...DEFAULT_PROTOTYPE_MODELS.map(() => 'prototype')]);
});

test('evaluation runner accepts repeated case selectors and an explicit legacy-ui comparator', () => {
    const { value } = loadFixture();
    const args = parseArgs([
        '--case=completed_refund_note',
        '--case', 'ready_not_draft_index',
        '--variants', 'legacy-ui,prototype',
        '--models', 'gpt-5.6-luna',
    ]);
    const planned = planRuns({ fixture: value, args });
    assert.equal(planned.length, 4);
    assert.deepEqual(new Set(planned.map(item => item.variant)), new Set(['legacy-ui', 'prototype']));
});
