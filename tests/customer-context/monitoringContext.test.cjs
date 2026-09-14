'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_ACTIONS,
    buildMonitoringPacket,
    evidenceForIds,
    evidenceIdsAreEligible,
    evidenceIdsAreNew,
} = require('../../src/modules/customer-context/monitoring/context.js');

const model = (attributes) => ({
    id: attributes.id,
    get: (key) => attributes[key],
    decrypted_action: () => attributes.decrypted_action,
});

test('monitoring packet keeps bounded, attributable direct observations and historical summaries separate', () => {
    const actions = Array.from({ length: MAX_ACTIONS + 2 }, (_, index) => model({
        id: `action-${index + 1}`,
        decrypted_action: `Observed action ${index + 1}`,
        created_at: `2026-09-08T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
    const packet = buildMonitoringPacket({
        actions,
        available_ais: [model({ id: 'ai-1', type: 'support' })],
        summaries: [model({
            id: 'summary-1',
            summary: 'Earlier activity was summarized from 12 observed actions.',
            start_at: '2026-09-08T09:00:00.000Z',
            end_at: '2026-09-08T09:10:00.000Z',
        })],
    });

    assert.equal(packet.audience, 'contact');
    assert.deepEqual(packet.available_help_types, ['support']);
    assert.equal(packet.direct_observations.length, MAX_ACTIONS);
    assert.equal(packet.direct_observations[0].evidence_id, 'action:action-3');
    assert.equal(packet.direct_observations.at(-1).evidence_id, `action:action-${MAX_ACTIONS + 2}`);
    assert.deepEqual(packet.historical_summaries, [{
        evidence_id: 'summary:summary-1',
        source: 'historical_summary',
        observed_from: '2026-09-08T09:00:00.000Z',
        observed_to: '2026-09-08T09:10:00.000Z',
        text: 'Earlier activity was summarized from 12 observed actions.',
    }]);
    assert.ok(packet.eligible_evidence_ids.includes('action:action-3'));
    assert.ok(packet.eligible_evidence_ids.includes('summary:summary-1'));
});

test('monitoring packet drops unreadable activity instead of treating ciphertext or blank content as evidence', () => {
    const packet = buildMonitoringPacket({
        actions: [
            model({ id: 'blank', decrypted_action: '   ', created_at: '2026-09-08T10:00:00.000Z' }),
            model({ id: 'usable', decrypted_action: 'Submitted a password reset.', created_at: '2026-09-08T10:01:00.000Z' }),
        ],
        summaries: [model({ id: 'empty-summary', summary: '', start_at: null, end_at: null })],
    });

    assert.deepEqual(packet.direct_observations.map((item) => item.evidence_id), ['action:usable']);
    assert.deepEqual(packet.historical_summaries, []);
    assert.deepEqual(packet.eligible_evidence_ids, ['action:usable']);
});

test('structured activity keeps event, location, title, and explicit errors ahead of bulky markup', () => {
    const packet = buildMonitoringPacket({
        actions: [model({
            id: 'structured',
            decrypted_action: JSON.stringify({
                html: `<html>${'x'.repeat(1200)}</html>`,
                eventType: 'form_submit',
                location: '/account/recovery',
                pageTitle: 'Account recovery',
                error: 'Reset link could not be sent.',
                element: { selector: '#reset-form', value: 'password reset' },
            }),
            created_at: '2026-09-08T10:01:00.000Z',
        })],
        summaries: [],
    });

    const text = packet.direct_observations[0].text;
    assert.match(text, /eventType: form_submit/);
    assert.match(text, /location: \/account\/recovery/);
    assert.match(text, /pageTitle: Account recovery/);
    assert.match(text, /error: Reset link could not be sent/);
    assert.equal(text.includes('<html>'), false);
    assert.ok(text.length <= 600);
});

test('monitoring packet does not expose profiles, private messages, or agent drafts', () => {
    const packet = buildMonitoringPacket({
        actions: [model({ id: 'a1', decrypted_action: 'Opened account recovery.', created_at: '2026-09-08T10:00:00.000Z' })],
        summaries: [],
        last_insights: [],
        contact: { name: 'Should not appear', ai_profile: { sensitive: true } },
        history: [{ content: 'Private customer conversation' }],
        agent_messages: [{ content: 'Private operator draft' }],
    });

    const serialized = JSON.stringify(packet);
    assert.equal(serialized.includes('Should not appear'), false);
    assert.equal(serialized.includes('Private customer conversation'), false);
    assert.equal(serialized.includes('Private operator draft'), false);
});

test('reused evidence cannot justify another outreach, while a newly observed event can', () => {
    const packet = buildMonitoringPacket({
        actions: [
            model({ id: 'used', decrypted_action: 'Payment attempt was declined.', created_at: '2026-09-08T10:00:00.000Z' }),
            model({ id: 'new', decrypted_action: 'Opened billing help.', created_at: '2026-09-08T10:01:00.000Z' }),
        ],
        last_insights: [model({
            id: 'insight-1',
            content: 'Need help with a payment?',
            metadata: { evidence_ids: ['action:used'] },
            created_at: '2026-09-08T10:00:30.000Z',
            closed_at: '2026-09-08T10:00:45.000Z',
        })],
    });

    assert.equal(evidenceIdsAreEligible(['action:used'], packet), true);
    assert.equal(evidenceIdsAreNew(['action:used'], packet), false);
    assert.equal(evidenceIdsAreNew(['action:used', 'action:new'], packet), true);
    assert.equal(evidenceIdsAreEligible(['action:missing'], packet), false);
    assert.deepEqual(evidenceForIds(packet, ['action:new']), [packet.direct_observations[1]]);
});
