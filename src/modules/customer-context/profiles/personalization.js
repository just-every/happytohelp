
import { fingerprint } from './evidence.js';

// Eligibility is already enforced by the evidence packet. Confidence changes
// within an approved category and private profile provenance do not change copy.
const personalizationFingerprint = (packet) => fingerprint({
    version: packet.version,
    company_identity: packet.company_identity,
    trusted_configuration: packet.trusted_configuration,
    approved_content: packet.approved_content,
    approved_broad_personalization: packet.approved_broad_personalization
        .map(({ key, value }) => ({ key, value }))
        .sort((left, right) => left.key.localeCompare(right.key)),
});

export { personalizationFingerprint };
