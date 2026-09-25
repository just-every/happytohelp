import assert from 'node:assert/strict';
import test from 'node:test';

// Contract of the neutral evidence selection (neutralSourceSelection in ai-support module.json):
// the five assist files that bound evidence, issue and validate evidence ids and page history.
import {
    MAX_PROVIDER_IMAGES,
    assistPacketMessageContent,
    evidenceIdsForPacket,
    imageInputsForPacket,
    packetForMessage,
    validateEvidenceIds,
} from '../../src/modules/ai-support/assist/packet.js';
import {
    INITIAL_PACKET_BUDGETS,
    boundActivity,
    boundProfile,
    boundSummaries,
    boundTimeline,
    serializedText,
} from '../../src/modules/ai-support/assist/packetBounds.js';
import { MAX_PRIMARY_TOOL_EVIDENCE_CHARS, createPrimaryToolEvidenceCollector } from '../../src/modules/ai-support/assist/passEvidence.js';
import { historyCursorForEntry, historyCursorParts, normalizeHistoryCursor } from '../../src/modules/ai-support/assist/historyCursor.js';
import { HISTORY_OUTPUT_BUDGETS, boundedHistoryPage, fullHistoryEntryChunk } from '../../src/modules/ai-support/assist/historyOutput.js';

const message = ({ id, content, second = 0, attachments = [] }) => ({
    evidence_id: `message:${id}`,
    kind: 'message',
    visibility: 'conversation',
    timestamp: `2026-09-07T00:00:${String(second).padStart(2, '0')}.000Z`,
    author: { id: 'contact-1', kind: 'contact', name: 'Customer' },
    content,
    attachments,
});

const image = (id, url = 'https://provider.example/image.png') => ({
    evidence_id: `context:${id}`,
    content_access: 'included-as-image',
    provider_image_url: url,
});

test('budgets are frozen with the documented values', () => {
    assert.ok(Object.isFrozen(INITIAL_PACKET_BUDGETS));
    assert.deepEqual({ ...INITIAL_PACKET_BUDGETS }, { timelineChars: 98304, activityChars: 16384, profileChars: 16384, summaryChars: 16384 });
    assert.ok(Object.isFrozen(HISTORY_OUTPUT_BUDGETS));
    assert.deepEqual({ ...HISTORY_OUTPUT_BUDGETS }, { maxEntryChars: 8000, maxResultChars: 12000, maxTextMetadataChars: 512 });
    assert.equal(MAX_PRIMARY_TOOL_EVIDENCE_CHARS, 49152);
    assert.equal(MAX_PROVIDER_IMAGES, 4);
});

test('boundTimeline keeps the newest entry intact and records recovery for older ones', () => {
    const older = message({ id: 'older', second: 1, content: 'o'.repeat(INITIAL_PACKET_BUDGETS.timelineChars) });
    const newest = message({ id: 'newest', second: 2, content: 'n'.repeat(INITIAL_PACKET_BUDGETS.timelineChars) });
    const [boundedOlder, boundedNewest] = boundTimeline([older, newest]);

    assert.equal(boundedNewest.content, newest.content);
    assert.equal(boundedNewest.content_truncated, undefined);
    assert.equal(boundedOlder.content, '');
    assert.equal(boundedOlder.content_truncated, true);
    assert.equal(boundedOlder.content_total_chars, INITIAL_PACKET_BUDGETS.timelineChars);
    assert.equal(boundedOlder.content_format, 'text');
    assert.deepEqual(boundedOlder.full_entry_retrieval, { tool: 'read_conversation_entry', evidence_id: 'message:older' });
});

test('boundTimeline bounds an event payload as json', () => {
    const event = { evidence_id: 'event:1', kind: 'event', timestamp: '2026-09-07T00:00:00.000Z', payload: { note: 'p'.repeat(INITIAL_PACKET_BUDGETS.timelineChars) } };
    const [bounded] = boundTimeline([event, message({ id: 'fill', second: 1, content: 'f'.repeat(INITIAL_PACKET_BUDGETS.timelineChars) })]);

    assert.equal(bounded.payload_truncated, true);
    assert.equal(bounded.payload_format, 'json');
    assert.deepEqual(bounded.full_entry_retrieval, { tool: 'read_conversation_entry', evidence_id: 'event:1' });
});

test('boundActivity and boundSummaries record unavailable content retrieval', () => {
    const entries = budget => [
        { evidence_id: 'context:old', content: 'a'.repeat(budget) },
        { evidence_id: 'context:new', content: 'b'.repeat(budget) },
    ];
    const [oldActivity] = boundActivity(entries(INITIAL_PACKET_BUDGETS.activityChars));
    const [oldSummary] = boundSummaries(entries(INITIAL_PACKET_BUDGETS.summaryChars));

    for (const bounded of [oldActivity, oldSummary]) {
        assert.equal(bounded.content_truncated, true);
        assert.deepEqual(bounded.content_retrieval, { available: false, reason: 'not-exposed-through-assist-tools' });
        assert.equal(bounded.full_entry_retrieval, undefined);
    }
});

test('boundProfile replaces an oversized profile with a bounded preview', () => {
    const small = { name: 'Customer' };
    assert.equal(boundProfile(small), small);

    const profile = { note: 'p'.repeat(INITIAL_PACKET_BUDGETS.profileChars * 2) };
    const bounded = boundProfile(profile);
    assert.equal(bounded._assist_profile_truncated, true);
    assert.equal(bounded.format, 'json');
    assert.equal(bounded.total_chars, JSON.stringify(profile).length);
    assert.equal(bounded.preview.length, INITIAL_PACKET_BUDGETS.profileChars);
    assert.deepEqual(bounded.content_retrieval, { available: false, reason: 'not-exposed-through-assist-tools' });
});

test('serializedText handles null, string, object and unserializable values', () => {
    assert.deepEqual(serializedText(null), { format: 'text', text: '' });
    assert.deepEqual(serializedText(undefined), { format: 'text', text: '' });
    assert.deepEqual(serializedText('plain'), { format: 'text', text: 'plain' });
    assert.deepEqual(serializedText({ a: 1 }), { format: 'json', text: '{"a":1}' });

    const cyclic = {};
    cyclic.self = cyclic;
    assert.deepEqual(serializedText(cyclic), { format: 'json', text: '[unserializable structured value]' });
    assert.deepEqual(serializedText(() => 1), { format: 'json', text: '' });
});

test('evidenceIdsForPacket collects every cited section and attachment', () => {
    const ids = evidenceIdsForPacket({
        company: { evidence_id: 'context:company' },
        customer: { evidence_id: 'context:customer', attachments: [{ evidence_id: 'context:logo' }] },
        timeline: [message({ id: '1', content: 'hi', attachments: [{ evidence_id: 'message:1:file' }] })],
        private_notes: [{ evidence_id: 'note:1' }],
        activity: [{ evidence_id: 'context:activity' }],
        summaries: [{ evidence_id: 'context:summary' }],
        knowledge: { catalog: [{ evidence_id: 'knowledge:rev-1' }] },
    });

    assert.deepEqual([...ids].sort(), [
        'context:activity', 'context:company', 'context:customer', 'context:logo', 'context:summary',
        'knowledge:rev-1', 'message:1', 'message:1:file', 'note:1',
    ]);
    assert.deepEqual([...evidenceIdsForPacket(undefined)], []);
});

test('validateEvidenceIds enforces the issued set', () => {
    const issued = new Set(['message:1']);
    assert.throws(() => validateEvidenceIds({ responses: [] }, ['message:1']), TypeError);
    assert.throws(() => validateEvidenceIds({ responses: [{ text: 'x' }] }, issued), TypeError);
    assert.throws(() => validateEvidenceIds({ responses: [{ evidence_ids: ['message:9'] }] }, issued), /unknown evidence IDs: message:9/);
    assert.throws(() => validateEvidenceIds({ responses: [{ evidence_ids: [7] }] }, issued), /unknown evidence IDs/);

    const output = { responses: [{ evidence_ids: ['message:1'] }] };
    assert.equal(validateEvidenceIds(output, issued), output);
});

test('imageInputsForPacket dedups by evidence id and caps at the provider image budget', () => {
    const attachments = Array.from({ length: MAX_PROVIDER_IMAGES + 3 }, (_unused, index) => image(`img-${index}`));
    const packet = { timeline: [message({ id: '1', content: 'hi', attachments: [...attachments, image('img-0')] })] };
    const inputs = imageInputsForPacket(packet);

    assert.equal(inputs.length, MAX_PROVIDER_IMAGES);
    assert.deepEqual(inputs.map(input => input.evidence_id), attachments.slice(0, MAX_PROVIDER_IMAGES).map(item => item.evidence_id));
    assert.deepEqual(inputs[0], { evidence_id: 'context:img-0', url: 'https://provider.example/image.png' });
    assert.deepEqual(imageInputsForPacket({ timeline: [message({ id: '2', content: 'no images' })] }), []);
});

test('packetForMessage marks excess image attachments unavailable', () => {
    const attachments = Array.from({ length: MAX_PROVIDER_IMAGES + 2 }, (_unused, index) => image(`img-${index}`));
    const packet = { timeline: [message({ id: '1', content: 'hi', attachments })] };
    const bounded = packetForMessage(packet, imageInputsForPacket(packet));
    const marked = bounded.timeline[0].attachments;

    for (const attachment of marked.slice(0, MAX_PROVIDER_IMAGES)) assert.equal(attachment.content_access, 'included-as-image');
    for (const attachment of marked.slice(MAX_PROVIDER_IMAGES)) {
        assert.equal(attachment.content_access, 'unavailable');
        assert.equal(attachment.unavailable_reason, 'image-input-budget-exhausted');
    }
});

test('assistPacketMessageContent strips image urls from the text and appends image parts in order', () => {
    const packet = {
        timeline: [message({
            id: '1',
            content: 'hi',
            attachments: [
                image('img-0', 'https://provider.example/a.png'),
                image('img-1', 'https://provider.example/b.png'),
                { evidence_id: 'context:inline', content_access: 'unavailable', url: 'data:image/png;base64,AAAA', preview_url: 'DATA:image/png;base64,BBBB' },
            ],
        })],
    };
    const parts = assistPacketMessageContent(packet);

    assert.equal(parts[0].type, 'text');
    assert.ok(!parts[0].text.includes('provider.example'));
    assert.ok(!/data:/i.test(parts[0].text));
    assert.deepEqual(parts.slice(1), [
        { type: 'text', text: 'The next image is attachment evidence context:img-0.' },
        { type: 'image_url', image_url: { url: 'https://provider.example/a.png' } },
        { type: 'text', text: 'The next image is attachment evidence context:img-1.' },
        { type: 'image_url', image_url: { url: 'https://provider.example/b.png' } },
    ]);

    const textOnly = assistPacketMessageContent({ timeline: [message({ id: '2', content: 'hi' })] });
    assert.equal(typeof textOnly, 'string');
});

test('the primary tool evidence collector ignores errors and icon lookups and enforces its budget', () => {
    const collector = createPrimaryToolEvidenceCollector();
    const done = (name, output, callId = 'call-1') => ({ type: 'tool_done', tool_call: { function: { name }, call_id: callId }, result: { output, call_id: callId } });

    collector.record({ type: 'tool_delta' });
    collector.record({ type: 'tool_done', tool_call: { function: { name: 'search' } }, result: { error: 'boom', output: 'x' } });
    collector.record(done('find_reply_icons', 'icons'));
    collector.record(done('search', null));
    collector.record(done('search', { rows: 2 }, 'call-2'));
    collector.record(done('read', 'y'.repeat(MAX_PRIMARY_TOOL_EVIDENCE_CHARS), 'call-3'));

    const snapshot = collector.snapshot();
    assert.equal(snapshot.source, 'primary-pass-tool-results');
    assert.equal(snapshot.output_char_budget, MAX_PRIMARY_TOOL_EVIDENCE_CHARS);
    assert.deepEqual(snapshot.outputs, [{ tool: 'search', call_id: 'call-2', output: '{"rows":2}' }]);
    assert.equal(snapshot.output_chars, '{"rows":2}'.length);
    assert.equal(snapshot.omitted_output_count, 1);

    const second = collector.snapshot();
    assert.notEqual(second.outputs, snapshot.outputs);
    assert.notEqual(second.outputs[0], snapshot.outputs[0]);
});

test('history cursors round-trip and reject malformed input', () => {
    assert.equal(normalizeHistoryCursor(null), null);
    assert.equal(normalizeHistoryCursor('  '), null);
    assert.equal(normalizeHistoryCursor('LATEST'), null);
    assert.equal(normalizeHistoryCursor('2026-09-07T00:00:05Z'), '2026-09-07T00:00:05.000Z');
    assert.equal(normalizeHistoryCursor('2026-09-07T00:00:05.000Z|message:abc'), '2026-09-07T00:00:05.000Z|message:abc');

    const malformed = /History cursor "before" must be "latest", an ISO timestamp/;
    assert.throws(() => normalizeHistoryCursor('yesterday'), malformed);
    assert.throws(() => normalizeHistoryCursor('2026-09-07T00:00:05.000Z|note:abc'), malformed);

    assert.deepEqual(historyCursorParts('2026-09-07T00:00:05.000Z|event:abc'), {
        cursor: '2026-09-07T00:00:05.000Z|event:abc',
        timestamp: '2026-09-07T00:00:05.000Z',
        evidence_id: 'event:abc',
        kind: 'event',
        id: 'abc',
    });
    assert.equal(historyCursorParts('latest'), null);
    assert.equal(historyCursorParts('2026-09-07T00:00:05.000Z').evidence_id, null);

    assert.equal(historyCursorForEntry(message({ id: 'abc', content: 'hi', second: 5 })), '2026-09-07T00:00:05.000Z|message:abc');
    assert.equal(historyCursorForEntry({ timestamp: '2026-09-07T00:00:05.000Z' }), null);
    assert.equal(historyCursorForEntry({ timestamp: '2026-09-07T00:00:05.000Z', evidence_id: 'note:abc' }), null);
});

test('boundedHistoryPage respects the result budget and reports omissions', () => {
    const entries = Array.from({ length: 30 }, (_unused, index) => message({ id: String(index), second: index, content: 'x'.repeat(900) }));
    const page = boundedHistoryPage({ before: null, property: 'results', entries });

    assert.ok(JSON.stringify(page).length <= HISTORY_OUTPUT_BUDGETS.maxResultChars);
    assert.ok(page.results.length > 0 && page.results.length < entries.length);
    assert.equal(page.output_window.omitted_entry_count, entries.length - page.results.length);
    assert.equal(page.output_window.max_chars, HISTORY_OUTPUT_BUDGETS.maxResultChars);
    assert.equal(page.output_window.complete_entry_tool, 'read_conversation_entry');
    assert.equal(page.results.at(-1).evidence_id, 'message:29');
    assert.equal(page.next_before, historyCursorForEntry(page.results[0]));
    assert.equal(page.before, null);
});

test('boundedHistoryPage degrades a single oversized entry to metadata only', () => {
    const attachments = Array.from({ length: 12 }, (_unused, index) => ({ evidence_id: `message:huge:${index}`, filename: 'f'.repeat(400) }));
    const entries = [message({ id: 'huge', content: 'x'.repeat(50_000), attachments })];
    const page = boundedHistoryPage({ before: '2026-09-07T00:01:00.000Z', entries, property: 'results' });

    assert.ok(JSON.stringify(page).length <= HISTORY_OUTPUT_BUDGETS.maxResultChars);
    assert.equal(page.results.length, 1);
    assert.equal(page.results[0].content, '');
    assert.equal(page.results[0].content_truncated, true);
    assert.equal(page.results[0].content_total_chars, 50_000);
    assert.equal(page.results[0].attachments.length, 12);
    assert.deepEqual(page.results[0].full_entry_retrieval, { tool: 'read_conversation_entry', evidence_id: 'message:huge' });
    assert.equal(page.output_window.truncated_entry_count, 1);
    assert.equal(page.output_window.omitted_entry_count, 0);
    assert.equal(page.before, '2026-09-07T00:01:00.000Z');
});

test('fullHistoryEntryChunk walks an entry through bounded offsets', () => {
    const entry = message({ id: 'large', content: '0123456789'.repeat(1000) });
    const first = fullHistoryEntryChunk(entry, { maxChars: 4000 });

    assert.equal(first.found, true);
    assert.equal(first.content_field, 'content');
    assert.equal(first.content_format, 'text');
    assert.equal(first.start_offset, 0);
    assert.equal(first.next_offset, 4000);
    assert.equal(first.total_chars, 10_000);
    assert.equal(first.entry.content, '');

    const last = fullHistoryEntryChunk(entry, { startOffset: 8000, maxChars: 4000 });
    assert.equal(last.content.length, 2000);
    assert.equal(last.next_offset, null);
    assert.equal(fullHistoryEntryChunk(entry, { startOffset: 99_999 }).content, '');
    assert.equal(fullHistoryEntryChunk(entry).content.length, HISTORY_OUTPUT_BUDGETS.maxEntryChars);
});
