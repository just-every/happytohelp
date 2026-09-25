const test = require('node:test');
const assert = require('node:assert/strict');
const { setupDocumentUrl, setupPrompt } = require('./localAgentSkillSetup');

test('the copied setup prompt points at the public project-scoped Markdown document', () => {
    const origin = 'http://127.0.0.1:8080';
    const projectId = '254787b6-301d-45ec-9f8c-b617ce311aae';
    const documentUrl = `${ origin }/local-agent/setup/${ projectId }.md`;

    assert.equal(setupDocumentUrl(origin, projectId), documentUrl);
    assert.equal(
        setupPrompt(origin, projectId),
        `Connect this Codex task to my HappyToHelp account and wait for support assignments. Follow the setup guide at ${ documentUrl }.`
    );
});
