'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildProfileEvidencePacket } = require('../../src/modules/customer-context/profiles/evidence.js');
const { buildProfilePrompt } = require('../../src/modules/customer-context/profiles/prompt.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'profile-evidence.v2.json'), 'utf8'));

test('public content personalization excludes private contact records and exposes only broad approved signals', () => {
    const context = {
        project: fixture.project,
        contact: fixture.contact,
        projectOptimize: fixture.projectOptimize,
        history: fixture.history,
        actions: fixture.actions,
    };
    const packet = buildProfileEvidencePacket('optimizeContact', context);
    const serialized = JSON.stringify(packet);

    assert.equal(serialized.includes('private.person@example.test'), false);
    assert.equal(serialized.includes('Private Person'), false);
    assert.equal(serialized.includes('secret account number'), false);
    assert.equal(serialized.includes('private account issue'), false);
    assert.deepEqual(packet.approved_broad_personalization.map((item) => item.key), ['user_type', 'personality']);
    assert.equal(packet.approved_content[0].text, 'Find an answer quickly.');

    const prompt = buildProfilePrompt('optimizeContact', context);
    assert.equal(prompt.messages[0].content.includes('Never mention or imply a person, account, message, activity, history, location, or private attribute.'), true);
    assert.equal(prompt.messages[1].content.includes('private.person@example.test'), false);
});

test('public personalization rejects legacy or freeform profile values even at high confidence', () => {
    const packet = buildProfileEvidencePacket('optimizeContact', {
        project: fixture.project,
        projectOptimize: fixture.projectOptimize,
        contact: {
            ai_profile: {
                user_type: { value: 'the named account owner', confidence: 100 },
                personality: { value: 'mentions their medical appointment', confidence: 100 },
            },
        },
    });
    assert.deepEqual(packet.approved_broad_personalization, []);
});
