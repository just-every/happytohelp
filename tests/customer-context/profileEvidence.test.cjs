'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildProfileEvidencePacket, hasContactProfileEvidence } = require('../../src/modules/customer-context/profiles/evidence.js');
const { isCurrentProfile, mergeProfile } = require('../../src/modules/customer-context/profiles/version.js');
const { isProfileCandidate } = require('../../src/modules/customer-context/profiles/validation.js');

const model = (attributes) => ({
    get: (key) => attributes[key],
});

const unknownContact = () => ({
    upcoming_events: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    user_type: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    problem: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    solutions_needed: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    job: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    role: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    risk_profile: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
    personality: { value: null, confidence: null, evidence_ids: [], evidence_status: 'unknown' },
});

test('profile evidence fingerprint skips unchanged evidence and triggers on a changed fact', () => {
    const context = {
        project: model({ name: 'Northstar', website: 'https://northstar.example' }),
        summaries: { models: [model({ id: 'summary-1', summary: 'The customer is comparing setup options.' })] },
        history: { models: [] },
        actions: { models: [] },
    };
    const first = buildProfileEvidencePacket('contact', context);
    const stored = { _profile_meta: { evidence_version: first.version, evidence_fingerprint: first.evidence_fingerprint } };

    assert.equal(isCurrentProfile(stored, first), true);

    context.summaries = { models: [model({ id: 'summary-2', summary: 'The customer cannot reset a password.' })] };
    const changed = buildProfileEvidencePacket('contact', context);
    assert.notEqual(changed.evidence_fingerprint, first.evidence_fingerprint);
    assert.equal(isCurrentProfile(stored, changed), false);
});

test('recurring widget idle telemetry neither qualifies contact evidence nor changes its fingerprint', () => {
    const idle = (id, seconds) => model({
        id,
        decrypted_action: `Detected extended inactivity (${seconds} seconds without interaction) - user may be hesitating`,
    });
    const context = {
        project: model({ name: 'Northstar' }),
        history: { models: [] },
        summaries: { models: [] },
        actions: { models: [idle('idle-1', 120), idle('idle-2', 240), idle('idle-3', 360), idle('idle-4', 480), idle('idle-5', 600)] },
    };

    const first = buildProfileEvidencePacket('contact', context);
    assert.deepEqual(first.evidence, []);
    assert.equal(hasContactProfileEvidence(context, 5), false);

    context.actions = { models: [idle('idle-6', 720), idle('idle-7', 840), idle('idle-8', 960), idle('idle-9', 1080), idle('idle-10', 1200)] };
    const idleChurn = buildProfileEvidencePacket('contact', context);
    assert.equal(idleChurn.evidence_fingerprint, first.evidence_fingerprint);
    assert.equal(hasContactProfileEvidence(context, 5), false);

    context.actions = {
        models: [
            model({ id: 'meaningful-old', decrypted_action: 'Opened the password reset form.' }),
            ...Array.from({ length: 30 }, (_, index) => idle(`idle-${index + 11}`, index + 1320)),
        ],
    };
    const meaningfulAction = buildProfileEvidencePacket('contact', context);
    assert.deepEqual(meaningfulAction.evidence.map((item) => item.id), ['action:meaningful-old']);
    assert.notEqual(meaningfulAction.evidence_fingerprint, idleChurn.evidence_fingerprint);
    assert.equal(hasContactProfileEvidence(context, 5), false);

    context.history = { models: [model({ id: 'message-1', contact_id: 'contact-1', content: 'I cannot reset my password.' })] };
    const meaningfulActivity = buildProfileEvidencePacket('contact', context);
    assert.equal(hasContactProfileEvidence(context, 5), true);
    assert.notEqual(meaningfulActivity.evidence_fingerprint, meaningfulAction.evidence_fingerprint);
    assert.deepEqual(meaningfulActivity.evidence.map((item) => item.id), ['message:message-1', 'action:meaningful-old']);
});

test('current attributed evidence corrects and retracts legacy high-confidence claims', () => {
    const packet = {
        evidence: [{ id: 'summary:current', source: 'customer_activity_summary', content: 'Password reset failed.' }],
        trusted_evidence: [],
    };
    const supported = unknownContact();
    supported.problem = {
        value: 'Password reset failed',
        confidence: 51,
        evidence_ids: ['summary:current'],
        evidence_status: 'supported',
    };

    assert.equal(isProfileCandidate('contact', supported, packet), true);
    const corrected = mergeProfile({ problem: { value: 'Checkout issue', confidence: 99 } }, supported, { evidence_fingerprint: 'changed' });
    assert.equal(corrected.profile.problem.value, 'Password reset failed');
    assert.equal(corrected.profile.problem.confidence, 51);

    const contradicted = unknownContact();
    contradicted.problem = {
        value: null,
        confidence: null,
        evidence_ids: ['summary:current'],
        evidence_status: 'contradicted',
    };
    const retracted = mergeProfile(corrected.profile, contradicted, { evidence_fingerprint: 'retracted' });
    assert.equal(Object.hasOwn(retracted.profile, 'problem'), false);
});

test('an unknown current result removes un-attributed legacy claims but retains attributed history', () => {
    const packet = { evidence: [{ id: 'summary:current' }], trusted_evidence: [] };
    const unknown = unknownContact();
    const legacy = mergeProfile({
        problem: { value: 'Legacy guessed problem', confidence: 99 },
        plan: { value: 'Legacy guessed plan', confidence: 99 },
    }, unknown, { ...packet, evidence_fingerprint: 'unknown-current' });

    assert.equal(Object.hasOwn(legacy.profile, 'problem'), false);
    assert.equal(Object.hasOwn(legacy.profile, 'plan'), false);

    const attributed = mergeProfile({
        problem: {
            value: 'Earlier directly observed problem',
            confidence: 72,
            evidence_ids: ['summary:older'],
            evidence_status: 'supported',
        },
    }, unknown, { ...packet, evidence_fingerprint: 'unknown-after-supported' });
    assert.equal(attributed.profile.problem.value, 'Earlier directly observed problem');
    assert.deepEqual(attributed.profile.problem.evidence_ids, ['summary:older']);
});

test('profile validation rejects a non-null claim without attributable current evidence', () => {
    const packet = { evidence: [{ id: 'summary:current' }], trusted_evidence: [] };
    const candidate = unknownContact();
    candidate.problem = {
        value: 'Unsupported claim',
        confidence: 80,
        evidence_ids: ['not-in-packet'],
        evidence_status: 'supported',
    };
    assert.equal(isProfileCandidate('contact', candidate, packet), false);
});
