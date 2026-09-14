

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const EVIDENCE_ID = /^(message|event):([A-Za-z0-9-]+)$/;

const invalidCursor = () => new Error(
    'History cursor "before" must be "latest", an ISO timestamp, or an ISO timestamp followed by "|message:id" or "|event:id". The search was not run.'
);

const normalizeHistoryCursor = value => {
    const raw = value === null || value === undefined ? '' : String(value).trim();
    if (!raw || raw.toLowerCase() === 'latest') return null;

    const separator = raw.indexOf('|');
    const timestampText = separator === -1 ? raw : raw.slice(0, separator);
    const evidenceId = separator === -1 ? null : raw.slice(separator + 1);
    if (!ISO_TIMESTAMP.test(timestampText) || (evidenceId && !EVIDENCE_ID.test(evidenceId))) {
        throw invalidCursor();
    }

    const timestamp = new Date(timestampText);
    if (Number.isNaN(timestamp.valueOf())) throw invalidCursor();
    return timestamp.toISOString() + (evidenceId ? `|${evidenceId}` : '');
};

const historyCursorParts = value => {
    const cursor = normalizeHistoryCursor(value);
    if (!cursor) return null;

    const separator = cursor.indexOf('|');
    const timestamp = separator === -1 ? cursor : cursor.slice(0, separator);
    const evidenceId = separator === -1 ? null : cursor.slice(separator + 1);
    const evidence = evidenceId ? evidenceId.match(EVIDENCE_ID) : null;

    return {
        cursor,
        timestamp,
        evidence_id: evidenceId,
        kind: evidence?.[1] || null,
        id: evidence?.[2] || null,
    };
};

const historyCursorForEntry = entry => {
    if (!entry?.timestamp || !entry?.evidence_id || !EVIDENCE_ID.test(entry.evidence_id)) return null;
    return normalizeHistoryCursor(`${entry.timestamp}|${entry.evidence_id}`);
};

export {
    historyCursorForEntry,
    historyCursorParts,
    normalizeHistoryCursor,
};
