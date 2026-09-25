

import { historyCursorForEntry } from './historyCursor.js';

const HISTORY_OUTPUT_BUDGETS = Object.freeze({
    maxEntryChars: 8000,
    maxResultChars: 12000,
    maxTextMetadataChars: 512,
});

const textValue = value => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
};

const jsonText = value => {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return '[unserializable event payload]';
    }
};

const truncateText = (value, maxChars) => {
    const text = textValue(value);
    const limit = Math.max(0, maxChars);
    return {
        text: text.length > limit ? text.slice(0, limit) : text,
        totalChars: text.length,
        truncated: text.length > limit,
    };
};

const compactText = value => truncateText(value, HISTORY_OUTPUT_BUDGETS.maxTextMetadataChars).text;

const compactAttachment = attachment => {
    const url = textValue(attachment?.url);
    const previewUrl = textValue(attachment?.preview_url);
    const hasInlineUrl = /^data:/i.test(url) || /^data:/i.test(previewUrl);

    return {
        evidence_id: attachment?.evidence_id || null,
        kind: attachment?.kind || 'attachment',
        visibility: attachment?.visibility || 'conversation',
        source_message_evidence_id: attachment?.source_message_evidence_id || null,
        aggregate_type: attachment?.aggregate_type || null,
        filename: compactText(attachment?.filename),
        size: attachment?.size ?? null,
        content_access: hasInlineUrl ? 'not-included-in-history-tool-output' : attachment?.content_access || 'unavailable',
        ...(hasInlineUrl ? { unavailable_reason: 'inline-attachment-omitted-from-history-tool-output' } : null),
    };
};

const compactAuthor = author => ({
    id: author?.id || null,
    kind: author?.kind || 'system',
    name: compactText(author?.name || 'System'),
});

const entryText = entry => {
    if (entry?.kind === 'event') {
        return { field: 'payload', format: typeof entry?.payload === 'string' ? 'text' : 'json', text: jsonText(entry?.payload) };
    }
    return { field: 'content', format: 'text', text: textValue(entry?.content) };
};

const compactHistoryEntry = (entry, maxChars = HISTORY_OUTPUT_BUDGETS.maxEntryChars) => {
    const body = entryText(entry);
    const preview = truncateText(body.text, maxChars);
    const compact = {
        evidence_id: entry?.evidence_id || null,
        kind: entry?.kind || 'message',
        visibility: entry?.visibility || 'conversation',
        timestamp: entry?.timestamp || null,
        author: compactAuthor(entry?.author),
        ...(entry?.kind === 'event' ? { event_type: entry?.event_type || 'UNKNOWN_EVENT' } : null),
        attachments: (entry?.attachments || []).map(compactAttachment),
        [body.field]: preview.text,
        [`${body.field}_format`]: body.format,
        [`${body.field}_total_chars`]: preview.totalChars,
    };

    if (preview.truncated) {
        compact[`${body.field}_truncated`] = true;
        compact.full_entry_retrieval = {
            tool: 'read_conversation_entry',
            evidence_id: compact.evidence_id,
        };
    }

    return compact;
};

const serializedLength = value => JSON.stringify(value).length;

const pageResult = ({ before, property, entries, omitted, truncatedEntries }) => {
    const output = {
        before: before || null,
        [property]: entries,
        next_before: historyCursorForEntry(entries[0]),
        output_window: {
            max_chars: HISTORY_OUTPUT_BUDGETS.maxResultChars,
            returned_entry_count: entries.length,
            omitted_entry_count: omitted,
            truncated_entry_count: truncatedEntries,
            complete_entry_tool: 'read_conversation_entry',
        },
    };
    output.output_window.serialized_chars = serializedLength(output);
    return output;
};

const boundedHistoryPage = ({ before, entries, property }) => {
    const selected = [];
    let truncatedEntries = 0;

    for (let index = (entries || []).length - 1; index >= 0; index -= 1) {
        const compact = compactHistoryEntry(entries[index]);
        const candidateEntries = [compact, ...selected];
        const candidateTruncated = truncatedEntries + Number(Boolean(compact.content_truncated || compact.payload_truncated));
        const candidate = pageResult({
            before,
            property,
            entries: candidateEntries,
            omitted: index,
            truncatedEntries: candidateTruncated,
        });

        if (candidate.output_window.serialized_chars <= HISTORY_OUTPUT_BUDGETS.maxResultChars) {
            selected.unshift(compact);
            truncatedEntries = candidateTruncated;
            continue;
        }

        if (selected.length > 0) break;

        const metadataOnly = compactHistoryEntry(entries[index], 0);
        const minimal = pageResult({
            before,
            property,
            entries: [metadataOnly],
            omitted: index,
            truncatedEntries: 1,
        });
        if (minimal.output_window.serialized_chars > HISTORY_OUTPUT_BUDGETS.maxResultChars) {
            throw new Error('History entry metadata exceeds the bounded history result budget.');
        }
        selected.unshift(metadataOnly);
        truncatedEntries = 1;
    }

    return pageResult({
        before,
        property,
        entries: selected,
        omitted: Math.max(0, (entries || []).length - selected.length),
        truncatedEntries,
    });
};

const fullHistoryEntryChunk = (entry, { startOffset = 0, maxChars = HISTORY_OUTPUT_BUDGETS.maxEntryChars } = {}) => {
    const body = entryText(entry);
    const start = Math.min(Math.max(0, Number.parseInt(startOffset, 10) || 0), body.text.length);
    const size = Math.max(1, Math.min(Number.parseInt(maxChars, 10) || HISTORY_OUTPUT_BUDGETS.maxEntryChars, HISTORY_OUTPUT_BUDGETS.maxEntryChars));
    const end = Math.min(body.text.length, start + size);

    return {
        found: true,
        entry: compactHistoryEntry(entry, 0),
        content_field: body.field,
        content_format: body.format,
        content: body.text.slice(start, end),
        start_offset: start,
        next_offset: end < body.text.length ? end : null,
        total_chars: body.text.length,
    };
};

export {
    HISTORY_OUTPUT_BUDGETS,
    boundedHistoryPage,
    compactHistoryEntry,
    fullHistoryEntryChunk,
};
