'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_ACTIONS, MAX_SUMMARIES } = require('../../src/modules/customer-context/monitoring/context.js');
const { selectSummaryBatch, metadataForSummaryContext } = require('../../src/modules/customer-context/monitoring/summary.js');

test('summary compaction selects only records it can include, leaving later evidence for a future batch', () => {
    const summaries = Array.from({ length: MAX_SUMMARIES + 2 }, (_, index) => ({ id: `summary-${index + 1}` }));
    const actions = Array.from({ length: MAX_ACTIONS + 3 }, (_, index) => ({ id: `action-${index + 1}` }));

    const batch = selectSummaryBatch(summaries, actions);

    assert.equal(batch.summaries.length, MAX_SUMMARIES);
    assert.equal(batch.actions.length, MAX_ACTIONS);
    assert.deepEqual(batch.summaries.map((item) => item.id), summaries.slice(0, MAX_SUMMARIES).map((item) => item.id));
    assert.deepEqual(batch.actions.map((item) => item.id), actions.slice(0, MAX_ACTIONS).map((item) => item.id));
    assert.deepEqual(summaries.slice(MAX_SUMMARIES).map((item) => item.id), ['summary-13', 'summary-14']);
    assert.deepEqual(actions.slice(MAX_ACTIONS).map((item) => item.id), ['action-61', 'action-62', 'action-63']);
});

test('summary persistence metadata stays inside the originating request context', () => {
    const firstContext = { summary_persist: 'The visitor arrived through a paid campaign.' };
    const secondContext = {};

    assert.deepEqual(metadataForSummaryContext(firstContext), {
        persist: 'The visitor arrived through a paid campaign.',
    });
    assert.equal(metadataForSummaryContext(secondContext), undefined);
    assert.equal(global.SUMMARY_PERSIST, undefined);
});
