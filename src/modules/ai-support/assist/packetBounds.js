

const INITIAL_PACKET_BUDGETS = Object.freeze({
    // This is a content budget for the complete initial timeline, not a limit on
    // its number of typed entries. Recent evidence stays present when older
    // entries consume the available text window.
    timelineChars: 96 * 1024,
    activityChars: 16 * 1024,
    profileChars: 16 * 1024,
    summaryChars: 16 * 1024,
});

const serializedText = value => {
    if (value === null || value === undefined) return { format: 'text', text: '' };
    if (typeof value === 'string') return { format: 'text', text: value };

    try {
        return { format: 'json', text: JSON.stringify(value) || '' };
    } catch {
        return { format: 'json', text: '[unserializable structured value]' };
    }
};

const truncateEntryField = ({ entry, field, maxChars, recovery }) => {
    const { format, text } = serializedText(entry?.[field]);
    if (text.length <= maxChars) return entry;

    return {
        ...entry,
        [field]: text.slice(0, Math.max(0, maxChars)),
        [`${field}_format`]: format,
        [`${field}_total_chars`]: text.length,
        [`${field}_truncated`]: true,
        ...(recovery ? { full_entry_retrieval: recovery(entry) } : {
            content_retrieval: {
                available: false,
                reason: 'not-exposed-through-assist-tools',
            },
        }),
    };
};

const boundEntriesNewestFirst = ({ entries, budget, fieldFor, recovery = null }) => {
    let remaining = budget;
    const bounded = new Array(entries.length);

    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        const field = fieldFor(entry);
        const text = serializedText(entry?.[field]).text;
        const allowed = Math.min(remaining, text.length);
        bounded[index] = truncateEntryField({
            entry,
            field,
            maxChars: allowed,
            recovery,
        });
        remaining -= allowed;
    }

    return bounded;
};

const boundTimeline = timeline => boundEntriesNewestFirst({
    entries: timeline,
    budget: INITIAL_PACKET_BUDGETS.timelineChars,
    fieldFor: entry => entry?.kind === 'event' ? 'payload' : 'content',
    recovery: entry => ({
        tool: 'read_conversation_entry',
        evidence_id: entry.evidence_id,
    }),
});

const boundActivity = activity => boundEntriesNewestFirst({
    entries: activity,
    budget: INITIAL_PACKET_BUDGETS.activityChars,
    fieldFor: () => 'content',
});

const boundSummaries = summaries => boundEntriesNewestFirst({
    entries: summaries,
    budget: INITIAL_PACKET_BUDGETS.summaryChars,
    fieldFor: () => 'content',
});

const boundProfile = profile => {
    const { format, text } = serializedText(profile);
    if (text.length <= INITIAL_PACKET_BUDGETS.profileChars) return profile;

    return {
        _assist_profile_truncated: true,
        format,
        total_chars: text.length,
        preview: text.slice(0, INITIAL_PACKET_BUDGETS.profileChars),
        content_retrieval: {
            available: false,
            reason: 'not-exposed-through-assist-tools',
        },
    };
};

export {
    INITIAL_PACKET_BUDGETS,
    boundActivity,
    boundEntriesNewestFirst,
    boundProfile,
    boundSummaries,
    boundTimeline,
    serializedText,
    truncateEntryField,
};
