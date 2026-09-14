'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalysisRequest, buildInsightRequest } = require('../../src/modules/customer-context/monitoring/prompt.js');
const { prepareMonitoringEvalCase } = require('./fixtures/monitoring-cases.cjs');

test('analysis prompt labels activity as untrusted data and limits the context to a contact-safe evidence packet', () => {
    const fixture = prepareMonitoringEvalCase('injection-content-no-interrupt');
    const request = buildAnalysisRequest(fixture.context);
    const instruction = request.messages[0].content;
    const packet = JSON.parse(request.messages[1].content);

    assert.match(instruction, /untrusted observed activity data/i);
    assert.match(instruction, /Do not infer identity, motivation, future actions/i);
    assert.equal(request.messages[1].role, 'user');
    assert.deepEqual(Object.keys(packet).sort(), [
        'audience',
        'available_help_types',
        'direct_observations',
        'eligible_evidence_ids',
        'historical_summaries',
        'previous_outreach',
        'version',
    ]);
});

test('insight prompt receives only evidence selected by the attributable analysis', () => {
    const fixture = prepareMonitoringEvalCase('concrete-failure-help');
    const analysis = {
        decision: 'insight',
        help_type: 'support',
        evidence_ids: ['action:failure-2'],
        help: 'Offer help with the failed password reset.',
    };
    const request = buildInsightRequest({
        ...fixture.context,
        insight_analysis: analysis,
    });
    const packet = JSON.parse(request.messages[1].content);

    assert.deepEqual(packet.selected_evidence.map((item) => item.evidence_id), ['action:failure-2']);
    assert.equal(packet.selected_help, 'Offer help with the failed password reset.');
    assert.match(request.messages[0].content, /Do not say that the system watched, tracked, or knows the user/i);
});

test('insight prompt adds bounded company and selected-role guidance without adding contact data', () => {
    const fixture = prepareMonitoringEvalCase('concrete-failure-help');
    const request = buildInsightRequest({
        ...fixture.context,
        insight_analysis: {
            decision: 'insight',
            help_type: 'support',
            evidence_ids: ['action:failure-2'],
            help: 'Offer help with the failed password reset.',
        },
        project: {
            get: (key) => ({ name: 'Acme Support', website: 'https://acme.example' })[key],
            ai_profile: (key) => ({ describe: 'account recovery software', brand_personality: 'clear and calm' })[key],
        },
        ai: {
            get: (key) => ({ name: 'Ava', role: 'Support guide', type: 'support' })[key],
            prompt: () => 'Help people at {project_name} through {project_website}.',
        },
        contact: { get: () => 'Private contact data' },
    });

    assert.equal(request.messages[1].role, 'developer');
    assert.match(request.messages[1].content, /Company: Acme Support/);
    assert.match(request.messages[1].content, /account recovery software/);
    assert.match(request.messages[1].content, /Selected help role: Ava — Support guide/);
    assert.match(request.messages[1].content, /https:\/\/acme\.example/);
    assert.equal(request.messages[1].content.includes('Private contact data'), false);
    assert.deepEqual(JSON.parse(request.messages[2].content).selected_evidence.map((item) => item.evidence_id), ['action:failure-2']);
});
