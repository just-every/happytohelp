
const MAX_ACTIONS = 60;
const MAX_SUMMARIES = 12;
const MAX_PREVIOUS_OUTREACH = 3;
const MAX_EVIDENCE_CHARS = 600;
const MAX_ACTION_FIELD_CHARS = 180;

const ACTION_FIELD_PRIORITY = [
    'event_type', 'event', 'type', 'action', 'name',
    'location', 'url', 'path', 'pathname', 'title', 'page_title',
    'error', 'message', 'reason', 'status', 'status_code', 'response',
    'details', 'text', 'target',
];
const BULKY_ACTION_FIELDS = new Set(['html', 'outerhtml', 'innerhtml', 'document', 'body', 'stylesheet']);

const values = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (Array.isArray(items.models)) return items.models;
    return [];
};

const modelValue = (model, key) => {
    if (!model) return undefined;
    return typeof model.get === 'function' ? model.get(key) : model[key];
};

const modelId = (model) => modelValue(model, 'id') || model?.id || null;

const textValue = (value) => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (!value || typeof value !== 'object') return '';

    try {
        return JSON.stringify(value);
    } catch (_) {
        return '';
    }
};

const compactText = (value) => {
    const text = textValue(value);
    if (text.length <= MAX_EVIDENCE_CHARS) return text;
    return `${text.slice(0, MAX_EVIDENCE_CHARS - 14)}… [truncated]`;
};

const boundedFieldValue = (value) => {
    const text = textValue(value);
    if (text.length <= MAX_ACTION_FIELD_CHARS) return text;
    return `${text.slice(0, MAX_ACTION_FIELD_CHARS - 14)}… [truncated]`;
};

const normalizedActionKey = (key) => String(key).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toLowerCase();

const structuredActionText = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const fields = [];
    const walk = (item, path = [], depth = 0) => {
        if (!item || depth > 3) return;
        if (Array.isArray(item)) {
            if (item.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))) {
                fields.push({ path: path.join('.'), key: normalizedActionKey(path.at(-1)), value: boundedFieldValue(item) });
            }
            return;
        }
        if (typeof item !== 'object') {
            const text = boundedFieldValue(item);
            if (text) fields.push({ path: path.join('.'), key: normalizedActionKey(path.at(-1)), value: text });
            return;
        }
        Object.entries(item).forEach(([key, child]) => {
            if (BULKY_ACTION_FIELDS.has(normalizedActionKey(key))) return;
            walk(child, [...path, key], depth + 1);
        });
    };
    walk(value);

    const indexed = new Map();
    fields.forEach((field, index) => indexed.set(index, field));
    const selected = [];
    ACTION_FIELD_PRIORITY.forEach((key) => {
        for (const [index, field] of indexed) {
            if (field.key === key) {
                selected.push(field);
                indexed.delete(index);
            }
        }
    });
    for (const field of indexed.values()) {
        if (selected.length >= 12) break;
        selected.push(field);
    }

    if (selected.length === 0) return null;
    return compactText(selected.map(({ path, value }) => `${path}: ${value}`).join('\n'));
};

const compactAction = (value) => {
    if (typeof value !== 'string') return structuredActionText(value) || compactText(value);

    const text = value.trim();
    if (!text) return '';
    try {
        return structuredActionText(JSON.parse(text)) || compactText(text);
    } catch (_) {
        return compactText(text);
    }
};

const isoTime = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const actionText = (action) => {
    if (typeof action?.decrypted_action === 'function') {
        return compactAction(action.decrypted_action());
    }

    return compactAction(modelValue(action, 'decrypted_action'));
};

const recent = (items, limit) => values(items).slice(-limit);

const buildDirectObservations = (actions) => recent(actions, MAX_ACTIONS)
    .map((action) => {
        const id = modelId(action);
        const text = actionText(action);
        if (!id || !text) return null;

        return {
            evidence_id: `action:${id}`,
            source: 'direct_observation',
            observed_at: isoTime(modelValue(action, 'created_at')),
            text,
        };
    })
    .filter(Boolean);

const buildHistoricalSummaries = (summaries) => recent(summaries, MAX_SUMMARIES)
    .map((summary) => {
        const id = modelId(summary);
        const text = compactText(modelValue(summary, 'summary'));
        if (!id || !text) return null;

        return {
            evidence_id: `summary:${id}`,
            source: 'historical_summary',
            observed_from: isoTime(modelValue(summary, 'start_at')),
            observed_to: isoTime(modelValue(summary, 'end_at')),
            text,
        };
    })
    .filter(Boolean);

const previousEvidenceIds = (insight) => {
    const metadata = modelValue(insight, 'metadata') || {};
    return Array.isArray(metadata.evidence_ids)
        ? metadata.evidence_ids.filter((id) => typeof id === 'string')
        : [];
};

const outreachOutcome = (insight) => {
    if (modelValue(insight, 'closed_at')) return 'dismissed';
    if (modelValue(insight, 'activated_at')) return 'activated';
    return 'shown';
};

const buildPreviousOutreach = (insights) => recent(insights, MAX_PREVIOUS_OUTREACH)
    .map((insight) => {
        const content = compactText(modelValue(insight, 'content'));
        if (!content) return null;

        return {
            sent_at: isoTime(modelValue(insight, 'created_at')),
            outcome: outreachOutcome(insight),
            content,
            evidence_ids: previousEvidenceIds(insight),
        };
    })
    .filter(Boolean);

const availableHelpTypes = (availableAis) => [...new Set(values(availableAis)
    .map((ai) => textValue(modelValue(ai, 'type')))
    .filter(Boolean))];

const buildMonitoringPacket = ({ actions, summaries, last_insights: lastInsights, available_ais: availableAis } = {}) => {
    const directObservations = buildDirectObservations(actions);
    const historicalSummaries = buildHistoricalSummaries(summaries);

    return {
        version: 'monitoring-v1',
        audience: 'contact',
        available_help_types: availableHelpTypes(availableAis),
        direct_observations: directObservations,
        historical_summaries: historicalSummaries,
        previous_outreach: buildPreviousOutreach(lastInsights),
        eligible_evidence_ids: [
            ...directObservations.map((observation) => observation.evidence_id),
            ...historicalSummaries.map((summary) => summary.evidence_id),
        ],
    };
};

const evidenceIdsAreEligible = (evidenceIds, packet) => {
    if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) return false;
    const eligible = new Set(packet?.eligible_evidence_ids || []);
    return evidenceIds.every((id) => typeof id === 'string' && eligible.has(id));
};

const evidenceIdsAreNew = (evidenceIds, packet) => {
    if (!evidenceIdsAreEligible(evidenceIds, packet)) return false;

    const previouslyUsed = new Set((packet?.previous_outreach || [])
        .flatMap((outreach) => outreach.evidence_ids || []));

    return evidenceIds.some((id) => !previouslyUsed.has(id));
};

const evidenceForIds = (packet, evidenceIds) => {
    const selected = new Set(evidenceIds || []);
    return [
        ...(packet?.direct_observations || []),
        ...(packet?.historical_summaries || []),
    ].filter((item) => selected.has(item.evidence_id));
};

export {
    MAX_ACTIONS,
    MAX_SUMMARIES,
    MAX_PREVIOUS_OUTREACH,
    availableHelpTypes,
    buildMonitoringPacket,
    evidenceForIds,
    evidenceIdsAreEligible,
    evidenceIdsAreNew,
};
