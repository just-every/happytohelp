

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    HISTORY_OUTPUT_BUDGETS,
    boundedHistoryPage,
    fullHistoryEntryChunk,
} from '../../src/modules/ai-support/assist/historyOutput.js';

const entry = ({ id, content, second = 0 }) => ({
    evidence_id: `message:${id}`,
    kind: 'message',
    visibility: 'conversation',
    timestamp: `2026-09-07T00:00:${String(second).padStart(2, '0')}.000Z`,
    author: { id: 'contact-1', kind: 'contact', name: 'Customer' },
    content,
    attachments: [],
});

test('bounded history pages keep typed evidence and advertise exact entry retrieval', () => {
    const entries = Array.from({ length: 20 }, (_unused, index) => entry({
        id: String(index),
        second: index,
        content: index === 19 ? 'z'.repeat(14000) : 'x'.repeat(700),
    }));
    const page = boundedHistoryPage({ before: null, property: 'results', entries });

    assert.ok(JSON.stringify(page).length <= HISTORY_OUTPUT_BUDGETS.maxResultChars);
    assert.ok(page.results.length < entries.length);
    assert.equal(page.output_window.omitted_entry_count, entries.length - page.results.length);
    assert.equal(page.results.at(-1).content_truncated, true);
    assert.deepEqual(page.results.at(-1).full_entry_retrieval, {
        tool: 'read_conversation_entry',
        evidence_id: 'message:19',
    });
    assert.equal(page.next_before, `2026-09-07T00:00:${String(20 - page.results.length).padStart(2, '0')}.000Z|message:${20 - page.results.length}`);
});

test('a truncated entry is completely retrievable through bounded sequential chunks', () => {
    const original = '0123456789'.repeat(1300);
    const historyEntry = entry({ id: 'large-message', content: original });
    let offset = 0;
    let reconstructed = '';

    while (offset !== null) {
        const chunk = fullHistoryEntryChunk(historyEntry, { startOffset: offset, maxChars: 4000 });
        reconstructed += chunk.content;
        offset = chunk.next_offset;
    }

    assert.equal(reconstructed, original);
});
