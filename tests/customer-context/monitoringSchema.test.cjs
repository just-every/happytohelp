'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMonitoringPacket } = require('../../src/modules/customer-context/monitoring/context.js');
const { monitoringAnalysisSchema, monitoringInsightSchema, toLegacyCollectorAnalysis } = require('../../src/modules/customer-context/monitoring/schema.js');

const action = (id, text) => ({
    id,
    decrypted_action: () => text,
    get: (key) => ({ id, created_at: '2026-09-08T10:00:00.000Z' })[key],
});

const packet = buildMonitoringPacket({ actions: [action('failure', 'Password reset failed.')], summaries: [] });

test('analysis schema requires attributable evidence and rejects identity or motivation fields', () => {
    const schema = monitoringAnalysisSchema({ packet, helpTypes: ['support'] });

    assert.equal(schema.safeParse({
        decision: 'insight',
        help_type: 'support',
        evidence_ids: ['action:failure'],
        help: 'Offer help with the failed password reset.',
    }).success, true);
    assert.equal(schema.safeParse({
        decision: 'insight',
        help_type: 'support',
        evidence_ids: [],
        help: 'Offer help.',
    }).success, false);
    assert.equal(schema.safeParse({
        decision: 'insight',
        help_type: 'sales',
        evidence_ids: ['action:failure'],
        help: 'Offer help.',
    }).success, false);
    assert.equal(schema.safeParse({
        decision: 'no_insight',
        help_type: null,
        evidence_ids: [],
        help: null,
        who: 'A price-sensitive prospect',
    }).success, false);
});

test('analysis schema makes insight impossible when no help type is available', () => {
    const schema = monitoringAnalysisSchema({ packet, helpTypes: [] });

    assert.equal(schema.safeParse({
        decision: 'no_insight',
        help_type: null,
        evidence_ids: [],
        help: null,
    }).success, true);
    assert.equal(schema.safeParse({
        decision: 'insight',
        help_type: 'support',
        evidence_ids: ['action:failure'],
        help: 'Offer help.',
    }).success, false);
});

test('insight schema accepts only new evidence selected by the analysis', () => {
    const analysis = {
        decision: 'insight',
        help_type: 'support',
        evidence_ids: ['action:failure'],
        help: 'Offer help with the failed password reset.',
    };
    const schema = monitoringInsightSchema({ packet, analysis });

    const valid = schema.safeParse({
        content: 'Would you like a hand with password recovery?',
        buttons: [
            { text: 'Help with recovery', action: 'send' },
            { text: 'Not now', action: 'close' },
        ],
        loading: 'Checking recovery options',
        evidence_ids: ['action:failure'],
    });
    assert.equal(valid.success, true);

    assert.equal(schema.safeParse({
        content: 'Would you like a hand?',
        buttons: [{ text: 'Not now', action: 'close' }],
        loading: null,
        evidence_ids: ['action:missing'],
    }).success, false);
});

test('analysis adapter changes only the legacy collector fields the existing sender consumes', () => {
    const legacy = toLegacyCollectorAnalysis({
        decision: 'insight',
        help_type: 'support',
        evidence_ids: ['action:failure'],
        help: 'Offer help with the failed password reset.',
    }, [{ get: (key) => key === 'type' ? 'support' : null }]);

    assert.deepEqual(legacy, {
        decision: 'insight',
        already_covered: false,
        evidence_ids: ['action:failure'],
        help_type: 'support',
        help: 'Offer help with the failed password reset.',
        support: {
            relevant: true,
            insight: 'Offer help with the failed password reset.',
            wait_for_more: false,
            can_continue: false,
        },
    });
});
