import assert from 'node:assert/strict';
import test from 'node:test';

import { evidenceIdsForPacket, validateEvidenceIds } from '../../src/modules/ai-support/assist/packet.js';
import { INITIAL_PACKET_BUDGETS, boundSummaries } from '../../src/modules/ai-support/assist/packetBounds.js';

// A consumer that resolves immutable Knowledge revisions into grounded sources maps
// them onto evidence ids; this documents the selection's contract from that side.
const resolvedSources = [
    {
        sourceId: 'rev-terms-12', sourceVersion: '12', retrievedAt: '2026-09-14T10:00:00.000Z',
        citation: { revisionId: 'rev-terms-12', title: 'Terms', version: 12, effectiveAt: '2026-08-20T00:00:00.000Z', publishedAt: '2026-08-19T09:00:00.000Z' },
        content: `Clause. ${'t'.repeat(INITIAL_PACKET_BUDGETS.summaryChars * 2)}`,
    },
    {
        sourceId: 'rev-refunds-3', sourceVersion: '3', retrievedAt: '2026-09-14T10:00:00.000Z',
        citation: { revisionId: 'rev-refunds-3', title: 'Refund window', version: 3, effectiveAt: '2026-09-01T00:00:00.000Z', publishedAt: '2026-08-30T09:00:00.000Z' },
        content: 'Refunds are available within 30 days of delivery.',
    },
    {
        sourceId: 'rev-shipping-7', sourceVersion: '7', retrievedAt: '2026-09-14T10:00:00.000Z',
        citation: { revisionId: 'rev-shipping-7', title: 'Shipping', version: 7, effectiveAt: '2026-09-05T00:00:00.000Z', publishedAt: '2026-09-04T09:00:00.000Z' },
        content: 'Standard shipping takes three business days.',
    },
];

const catalogEntry = source => ({
    evidence_id: `knowledge:${source.citation.revisionId}`,
    source_version: source.sourceVersion,
    retrieved_at: source.retrievedAt,
    title: source.citation.title,
    revision_version: source.citation.version,
    effective_at: source.citation.effectiveAt,
    published_at: source.citation.publishedAt,
    content: source.content,
});

// The consumer's citation parser accepts only citations inside the resolved snapshot.
const parseCitedAiOutput = (value, sourceIds) => {
    const permitted = new Set(sourceIds);
    if (value.citedSourceIds.some(id => !permitted.has(id))) throw new Error('AI output cites a source outside the resolved request snapshot.');
    return value;
};

const preparedPacket = () => {
    const packet = { knowledge: { catalog: boundSummaries(resolvedSources.map(catalogEntry)) } };
    return { packet, issued: evidenceIdsForPacket(packet) };
};

test('a consumer bounds resolved Knowledge sources and keeps the truncated one visible', () => {
    const { packet, issued } = preparedPacket();
    const [terms, refunds, shipping] = packet.knowledge.catalog;

    assert.equal(terms.content_truncated, true);
    assert.equal(terms.content_total_chars, resolvedSources[0].content.length);
    assert.equal(terms.content_retrieval.available, false);
    assert.equal(terms.content_retrieval.reason, 'not-exposed-through-assist-tools');
    assert.equal(refunds.content, resolvedSources[1].content);
    assert.equal(shipping.content, resolvedSources[2].content);
    assert.deepEqual([...issued].sort(), ['knowledge:rev-refunds-3', 'knowledge:rev-shipping-7', 'knowledge:rev-terms-12']);
});

test('a compliant cited output passes validation and maps back to revision ids', () => {
    const { issued } = preparedPacket();
    const output = { responses: [{ answer: 'Refunds close after 30 days.', evidence_ids: ['knowledge:rev-refunds-3'] }] };

    assert.equal(validateEvidenceIds(output, issued), output);

    const citedSourceIds = output.responses[0].evidence_ids.map(id => id.slice('knowledge:'.length));
    const parsed = parseCitedAiOutput({ answer: output.responses[0].answer, citedSourceIds, missingFacts: [] }, resolvedSources.map(source => source.sourceId));
    assert.deepEqual(parsed.citedSourceIds, ['rev-refunds-3']);
});

test('an output citing a revision outside the snapshot is rejected before parsing', () => {
    const { issued } = preparedPacket();
    const output = { responses: [{ answer: 'Stale.', evidence_ids: ['knowledge:rev-refunds-2'] }] };

    assert.throws(() => validateEvidenceIds(output, issued), /unknown evidence IDs: knowledge:rev-refunds-2/);
    assert.throws(
        () => parseCitedAiOutput({ answer: 'Stale.', citedSourceIds: ['rev-refunds-2'], missingFacts: [] }, resolvedSources.map(source => source.sourceId)),
        /outside the resolved request snapshot/,
    );
});
