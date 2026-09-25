'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DISMISSAL_COOLDOWNS_MS,
    getInsightDismissalCooldown,
} = require('../../src/modules/customer-context/collector/insightCooldown.js');

const insight = (aiType, closedAt) => ({
    ai_type: aiType,
    closed_at: closedAt,
});

test('insight dismissal cooldown escalates from 24 hours to 6 months', () => {
    const firstClosedAt = new Date('2026-01-01T00:00:00.000Z');
    let cooldown = getInsightDismissalCooldown([
        insight('sales', firstClosedAt),
    ], new Date(firstClosedAt.getTime() + DISMISSAL_COOLDOWNS_MS[0] - 1));

    assert.equal(cooldown.active, true);
    assert.equal(cooldown.dismissalCount, 1);
    assert.equal(cooldown.nextEligibleAt.getTime(), firstClosedAt.getTime() + DISMISSAL_COOLDOWNS_MS[0]);

    cooldown = getInsightDismissalCooldown([
        insight('sales', '2026-01-01T00:00:00.000Z'),
        insight('support', '2026-01-02T00:00:00.000Z'),
    ], new Date('2026-01-08T23:59:59.999Z'));

    assert.equal(cooldown.active, true);
    assert.equal(cooldown.dismissalCount, 2);
    assert.equal(cooldown.nextEligibleAt.toISOString(), '2026-01-09T00:00:00.000Z');

    cooldown = getInsightDismissalCooldown([
        insight('sales', '2026-01-01T00:00:00.000Z'),
        insight('support', '2026-01-02T00:00:00.000Z'),
        insight('sales', '2026-01-03T00:00:00.000Z'),
    ], new Date('2026-02-01T00:00:00.000Z'));

    assert.equal(cooldown.active, true);
    assert.equal(cooldown.dismissalCount, 3);
    assert.equal(cooldown.nextEligibleAt.toISOString(), '2026-02-02T00:00:00.000Z');

    cooldown = getInsightDismissalCooldown([
        insight('sales', '2026-01-01T00:00:00.000Z'),
        insight('support', '2026-01-02T00:00:00.000Z'),
        insight('sales', '2026-01-03T00:00:00.000Z'),
        insight('support', '2026-01-04T00:00:00.000Z'),
        insight('sales', '2026-01-05T00:00:00.000Z'),
    ], new Date('2026-07-05T23:59:59.999Z'));

    assert.equal(cooldown.active, true);
    assert.equal(cooldown.dismissalCount, 5);
    assert.equal(cooldown.nextEligibleAt.toISOString(), '2026-07-06T00:00:00.000Z');
});

test('insight dismissal cooldown ignores non-sales/support and expires at boundary', () => {
    const closedAt = new Date('2026-01-01T00:00:00.000Z');
    const cooldown = getInsightDismissalCooldown([
        insight('billing', '2026-01-03T00:00:00.000Z'),
        insight('sales', closedAt),
        insight('support', null),
    ], new Date(closedAt.getTime() + DISMISSAL_COOLDOWNS_MS[0]));

    assert.equal(cooldown.active, false);
    assert.equal(cooldown.dismissalCount, 1);
    assert.equal(cooldown.nextEligibleAt.getTime(), closedAt.getTime() + DISMISSAL_COOLDOWNS_MS[0]);
});
