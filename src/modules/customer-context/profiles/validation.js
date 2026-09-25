
const PROFILE_KEYS = {
    project: ['describe', 'short_name', 'legal_name', 'primary_pages', 'type', 'business_model', 'possible_users', 'brand_personality'],
    agent: ['personality', 'common_greetings', 'common_sign_off', 'uniqueness'],
    contact: ['upcoming_events', 'user_type', 'problem', 'solutions_needed', 'job', 'role', 'risk_profile', 'personality'],
};

const isProfileCandidate = (type, candidate, packet) => {
    const keys = PROFILE_KEYS[type];
    const allowedIds = new Set([
        ...(packet?.evidence || []),
        ...(packet?.trusted_evidence || []),
    ].map((item) => item.id));
    if (!keys || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    return keys.every((key) => Object.prototype.hasOwnProperty.call(candidate, key)
        && candidate[key]
        && typeof candidate[key] === 'object'
        && Object.prototype.hasOwnProperty.call(candidate[key], 'value')
        && typeof candidate[key].evidence_status === 'string'
        && Array.isArray(candidate[key].evidence_ids)
        && ((candidate[key].evidence_status === 'supported'
            && candidate[key].value !== null
            && Number.isInteger(candidate[key].confidence)
                && candidate[key].confidence >= 0
                && candidate[key].confidence <= 100
                && candidate[key].evidence_ids.length > 0
                && hasEvidenceIds(candidate[key], allowedIds))
            || (candidate[key].value === null
                && ['unknown', 'contradicted'].includes(candidate[key].evidence_status)
                && (candidate[key].evidence_status !== 'contradicted'
                    || (candidate[key].evidence_ids.length > 0 && hasEvidenceIds(candidate[key], allowedIds))))));
};

const hasEvidenceIds = (candidate, allowedIds) => candidate.evidence_ids.every((id) => allowedIds.has(id));

const isOptimizationCandidate = (candidate, packet) => {
    const documents = new Map((packet?.evidence || []).map((item) => [item.id, item]));
    return Boolean(candidate
    && typeof candidate === 'object'
    && Array.isArray(candidate.pages)
    && candidate.pages.every((page) => page
        && typeof page.url === 'string'
        && typeof page.text === 'string'
        && typeof page.selector === 'string'
        && typeof page.evidence_id === 'string'
        && documents.has(page.evidence_id)
        && documents.get(page.evidence_id).url === page.url
        && documents.get(page.evidence_id).content.includes(page.text)));
};

const isContactOptimizationCandidate = (candidate, packet) => {
    const content = new Map((packet?.approved_content || []).map((item) => [item.id, item]));
    const signalIds = new Set((packet?.approved_broad_personalization || []).map((item) => item.id));
    return Boolean(candidate
        && typeof candidate === 'object'
        && Array.isArray(candidate.pages)
        && candidate.pages.every((page) => page
            && typeof page.url === 'string'
            && typeof page.text === 'string'
            && typeof page.selector === 'string'
            && typeof page.content_id === 'string'
            && content.has(page.content_id)
            && content.get(page.content_id).url === page.url
            && content.get(page.content_id).selector === page.selector
            && Array.isArray(page.evidence_ids)
            && hasEvidenceIds(page, signalIds)));
};

export {
    isOptimizationCandidate,
    isContactOptimizationCandidate,
    isProfileCandidate,
};
