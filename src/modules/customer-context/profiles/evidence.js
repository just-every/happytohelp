
import { createHash } from 'node:crypto';
import { isRecurringWidgetIdleAction } from '../collector/widgetIdleAction.js';

const EVIDENCE_VERSION = 'profile-evidence.v3';

const LIMITS = {
    documentCount: 12,
    documentChars: 2_400,
    messageCount: 24,
    messageChars: 1_000,
    summaryCount: 16,
    summaryChars: 900,
    actionCount: 24,
    actionChars: 600,
    agentMessageCount: 40,
    agentMessageChars: 900,
};

const PUBLIC_PERSONALIZATION_FIELDS = new Set(['user_type', 'personality']);
const PUBLIC_USER_TYPES = new Set([
    'visitor', 'buyer', 'subscriber', 'researcher', 'student', 'developer',
    'support_seeker', 'administrator', 'partner', 'client_customer', 'influencer', 'other',
]);
const PUBLIC_PERSONALITIES = new Set([
    'concise', 'informative', 'conversational', 'creative', 'analytical',
    'empathetic', 'decisive', 'explorative', 'collaborative',
]);

const modelValue = (model, key, fallback = null) => {
    if (model && typeof model.get === 'function') {
        const value = model.get(key);
        return value === undefined ? fallback : value;
    }
    if (model && Object.prototype.hasOwnProperty.call(model, key)) {
        return model[key];
    }
    return fallback;
};

const models = (collection) => {
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection?.models)) return collection.models;
    return [];
};

const text = (value, limit) => {
    if (typeof value !== 'string') return '';
    const compact = value.replace(/\u0000/g, '').trim();
    if (compact.length <= limit) return compact;
    return `${compact.slice(0, limit)}…`;
};

const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((out, key) => {
        out[key] = stable(value[key]);
        return out;
    }, {});
};

const fingerprint = (value) => createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');

const profileWithoutMetadata = (profile) => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
    return Object.entries(profile).reduce((out, [key, value]) => {
        if (key !== '_profile_meta') out[key] = value;
        return out;
    }, {});
};

const companyIdentity = (project) => {
    const values = {};
    for (const key of ['name', 'website', 'help_center_domain', 'timezone']) {
        const value = modelValue(project, key);
        if (typeof value === 'string' && value.trim()) values[key] = value.trim();
    }
    return values;
};

const trustedConfiguration = (project) => {
    const metadata = modelValue(project, 'metadata', {}) || {};
    const widgetSettings = modelValue(project, 'widget_settings', {}) || {};
    const values = {};
    for (const [key, value] of Object.entries({
        brand_tone: metadata.brand_tone || metadata.brand_personality || widgetSettings.brand_tone,
        company_voice: metadata.company_voice || widgetSettings.company_voice,
    })) {
        if (typeof value === 'string' && value.trim()) values[key] = value.trim();
    }
    return values;
};

const trustedEvidence = (identity, configuration) => [
    ...Object.entries(identity).map(([key, value]) => ({
        id: `configured-company:${key}`,
        source: 'configured_company_identity',
        key,
        value,
    })),
    ...Object.entries(configuration).map(([key, value]) => ({
        id: `configured-company:${key}`,
        source: 'configured_company_tone',
        key,
        value,
    })),
];

const documentEvidence = (datasetFiles) => models(datasetFiles)
    .slice(0, LIMITS.documentCount)
    .map((file, index) => {
        const content = text(modelValue(file, 'markdown') || modelValue(file, 'html'), LIMITS.documentChars);
        if (!content) return null;
        return {
            id: `document:${modelValue(file, 'id', index)}`,
            source: 'approved_knowledge_document',
            url: text(modelValue(file, 'url'), 1_000),
            title: text(modelValue(file, 'title'), 500),
            content,
        };
    })
    .filter(Boolean);

const messageEvidence = (history) => models(history)
    .filter((message) => modelValue(message, 'type') !== 'thinking')
    .slice(-LIMITS.messageCount)
    .map((message, index) => {
        const content = text(modelValue(message, 'content'), LIMITS.messageChars);
        if (!content) return null;
        return {
            id: `message:${modelValue(message, 'id', index)}`,
            source: modelValue(message, 'contact_id') ? 'customer_message' : 'agent_message',
            visibility: 'private_operational_evidence',
            occurred_at: modelValue(message, 'created_at'),
            content,
        };
    })
    .filter(Boolean);

const summaryEvidence = (summaries) => models(summaries)
    .slice(-LIMITS.summaryCount)
    .map((summary, index) => {
        const content = text(modelValue(summary, 'summary'), LIMITS.summaryChars);
        if (!content) return null;
        return {
            id: `summary:${modelValue(summary, 'id', index)}`,
            source: 'customer_activity_summary',
            visibility: 'private_operational_evidence',
            content,
        };
    })
    .filter(Boolean);

const actionContent = (action) => text(
    typeof action?.decrypted_action === 'function'
        ? action.decrypted_action()
        : modelValue(action, 'decrypted_action') || modelValue(action, 'action'),
    LIMITS.actionChars,
);

const actionEvidence = (actions) => models(actions)
    .map((action, index) => ({ action, index, content: actionContent(action) }))
    // Filter before applying the window so recurring idle events cannot displace real activity.
    .filter(({ content }) => content && !isRecurringWidgetIdleAction(content))
    .slice(-LIMITS.actionCount)
    .map(({ action, index, content }) => {
        return {
            id: `action:${modelValue(action, 'id', index)}`,
            source: 'customer_activity',
            visibility: 'private_operational_evidence',
            content,
        };
    })
    .filter(Boolean);

const hasContactProfileEvidence = (context, minimumActionCount) => messageEvidence(context.history).length > 0
    || summaryEvidence(context.summaries).length > 0
    || actionEvidence(context.actions).length >= minimumActionCount;

const agentMessageEvidence = (messages) => models(messages)
    .slice(-LIMITS.agentMessageCount)
    .map((message, index) => {
        const content = text(modelValue(message, 'content'), LIMITS.agentMessageChars);
        if (!content) return null;
        return {
            id: `agent-message:${modelValue(message, 'id', index)}`,
            source: 'agent_reply',
            visibility: 'private_operational_evidence',
            occurred_at: modelValue(message, 'created_at'),
            content,
        };
    })
    .filter(Boolean);

const publicSignals = (contact) => {
    const profile = profileWithoutMetadata(modelValue(contact, 'ai_profile', {}));
    return Object.entries(profile)
        .filter(([key, entry]) => PUBLIC_PERSONALIZATION_FIELDS.has(key)
            && typeof entry?.value === 'string'
            && Number.isInteger(entry?.confidence)
            && entry.confidence >= 60
            && entry.evidence_status === 'supported'
            && Array.isArray(entry.evidence_ids)
            && entry.evidence_ids.length > 0
            && (key === 'user_type' ? PUBLIC_USER_TYPES.has(entry.value) : PUBLIC_PERSONALITIES.has(entry.value)))
        .map(([key, entry]) => ({
            id: `approved-contact-signal:${key}`,
            source: 'approved_broad_personalization_signal',
            key,
            value: entry.value,
            confidence: entry.confidence,
        }));
};

const selectedContent = (projectOptimize) => {
    const profile = modelValue(projectOptimize, 'ai_profile', {});
    const pages = Array.isArray(profile?.pages) ? profile.pages : [];
    return pages.slice(0, 10).map((page, index) => ({
        id: `approved-content:${index}`,
        source: 'approved_site_content',
        url: text(page?.url, 1_000),
        text: text(page?.text, 2_400),
        selector: text(page?.selector, 500),
    })).filter((page) => page.url && page.text && page.selector);
};

const buildProfileEvidencePacket = (type, context) => {
    const project = context.project || (type === 'project' ? context.project : null);
    const identity = companyIdentity(project);
    const configuration = trustedConfiguration(project);
    const packet = {
        version: EVIDENCE_VERSION,
        type,
        company_identity: identity,
        trusted_configuration: configuration,
        trusted_evidence: trustedEvidence(identity, configuration),
        evidence: [],
    };

    if (type === 'project' || type === 'optimize') {
        packet.evidence = documentEvidence(context.dataset_files);
    }
    else if (type === 'agent') {
        packet.evidence = agentMessageEvidence(context.agent_messages);
    }
    else if (type === 'contact') {
        packet.evidence = [
            ...messageEvidence(context.history),
            ...summaryEvidence(context.summaries),
            ...actionEvidence(context.actions),
        ];
    }
    else if (type === 'optimizeContact') {
        packet.approved_content = selectedContent(context.projectOptimize);
        packet.approved_broad_personalization = publicSignals(context.contact);
    }

    packet.evidence_fingerprint = fingerprint({
        version: packet.version,
        type: packet.type,
        company_identity: packet.company_identity,
        trusted_configuration: packet.trusted_configuration,
        trusted_evidence: packet.trusted_evidence,
        evidence: packet.evidence,
        approved_content: packet.approved_content,
        approved_broad_personalization: packet.approved_broad_personalization,
    });
    return packet;
};

export {
    EVIDENCE_VERSION,
    buildProfileEvidencePacket,
    fingerprint,
    hasContactProfileEvidence,
    isRecurringWidgetIdleAction,
    modelValue,
    profileWithoutMetadata,
};
