
import { EVIDENCE_VERSION, profileWithoutMetadata } from './evidence.js';

const PROFILE_META_KEY = '_profile_meta';

const profileMetadata = (profile) => profile && typeof profile === 'object'
    ? profile[PROFILE_META_KEY] || {}
    : {};

const isCurrentProfile = (profile, packet) => {
    const metadata = profileMetadata(profile);
    return metadata.evidence_version === EVIDENCE_VERSION
        && metadata.evidence_fingerprint === packet.evidence_fingerprint;
};

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const validEntry = (entry) => Boolean(entry
    && typeof entry === 'object'
    && Object.prototype.hasOwnProperty.call(entry, 'value')
    && typeof entry.evidence_status === 'string'
    && Array.isArray(entry.evidence_ids)
    && ((entry.evidence_status === 'supported'
        && entry.value !== null
        && Number.isInteger(entry.confidence)
            && entry.confidence >= 0
            && entry.confidence <= 100
            && entry.evidence_ids.length > 0)
        || (entry.value === null
            && ['unknown', 'contradicted'].includes(entry.evidence_status)
            && (entry.evidence_status !== 'contradicted' || entry.evidence_ids.length > 0))));

const supportedAttributedEntry = (entry) => validEntry(entry)
    && entry.evidence_status === 'supported';

const trustedConfiguredEntries = (packet) => (packet?.trusted_evidence || []).reduce((entries, evidence) => {
    if (evidence?.source === 'configured_company_tone' && evidence.key === 'brand_tone' && typeof evidence.value === 'string') {
        entries.brand_personality = {
            value: evidence.value,
            confidence: 100,
            evidence_ids: [evidence.id],
            evidence_status: 'supported',
        };
    }
    return entries;
}, {});

const mergeProfile = (existing, candidate, packet) => {
    const before = Object.entries(profileWithoutMetadata(existing)).reduce((entries, [key, entry]) => {
        // A legacy score alone is not provenance. Do not carry it forward under a
        // current evidence version, especially when this pass says the field is unknown.
        if (supportedAttributedEntry(entry)) entries[key] = entry;
        return entries;
    }, trustedConfiguredEntries(packet));
    const next = { ...before };

    for (const [key, entry] of Object.entries(candidate || {})) {
        if (!validEntry(entry)) continue;
        if (entry.evidence_status === 'contradicted') {
            delete next[key];
        }
        else if (entry.evidence_status === 'supported') {
            // Current attributable evidence supersedes a legacy numeric score.
            next[key] = entry;
        }
    }

    const changed = !same(before, next);
    return {
        changed,
        profile: {
            ...next,
            [PROFILE_META_KEY]: {
                evidence_version: EVIDENCE_VERSION,
                evidence_fingerprint: packet.evidence_fingerprint,
            },
        },
    };
};

const saveOptimizationProfile = (existing, candidate, packet) => {
    const before = existing && typeof existing === 'object' ? existing : {};
    const next = {
        ...candidate,
        [PROFILE_META_KEY]: {
            evidence_version: EVIDENCE_VERSION,
            evidence_fingerprint: packet.evidence_fingerprint,
        },
    };
    return { changed: !same(profileWithoutMetadata(before), profileWithoutMetadata(next)), profile: next };
};

export {
    PROFILE_META_KEY,
    isCurrentProfile,
    mergeProfile,
    saveOptimizationProfile,
    validEntry,
    supportedAttributedEntry,
};
