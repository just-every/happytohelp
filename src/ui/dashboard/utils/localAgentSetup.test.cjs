const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildLocalAgentCommands, isWorkerReady, pairedDevice, shellQuote } = require('./localAgentSetup');

const options = {
    origin: 'https://help.justevery.com',
    projectId: '254787b6-301d-45ec-9f8c-b617ce311aae',
    code: 'PAIR-123',
    name: "James's computer",
};

test('the recommended startup block installs and starts one scoped Codex worker', () => {
    const { setupCommand, startCommand, disconnectCommand } = buildLocalAgentCommands(options);
    execFileSync('bash', ['-n'], { input: setupCommand });
    assert.match(setupCommand, /curl -fsSL/);
    assert.match(setupCommand, /bin\/h2h-local\.mjs" start --server/);
    assert.match(setupCommand, /--provider codex/);
    assert.doesNotMatch(setupCommand, /ANTHROPIC|mcp add|npm install/);
    assert.match(startCommand, /H2H_LOCAL_CONFIG="\$HOME\/\.config\/happytohelp\/254787b6-301d-45ec-9f8c-b617ce311aae.json"/);
    assert.doesNotMatch(startCommand, /PAIR-123|--code|--server/);
    assert.equal(disconnectCommand, startCommand.replace(/ start$/, ' disconnect'));
    execFileSync('bash', ['-n'], { input: disconnectCommand });
});

test('user-entered computer names remain literal shell arguments', () => {
    const value = "Desk's `uname` $(id) ; echo dangerous\nsecond line";
    const actual = execFileSync('bash', ['-c', `printf '%s' ${ shellQuote(value) }`], { encoding: 'utf8' });
    assert.equal(actual, value);
    execFileSync('bash', ['-n'], { input: buildLocalAgentCommands({ ...options, name: value }).setupCommand });
});

test('existing-session setup registers an absolute executable and scoped credentials without starting a competing worker', () => {
    for (const provider of ['codex', 'claude']) {
        const { setupCommand, mcpCommand } = buildLocalAgentCommands({ ...options, provider, session: true });
        execFileSync('bash', ['-n'], { input: setupCommand });
        assert.match(setupCommand, /\.mjs" connect --server/);
        assert.doesNotMatch(setupCommand, /\.mjs" start/);
        assert.match(mcpCommand, /--env H2H_LOCAL_CONFIG="\$HOME\//);
        assert.match(mcpCommand, /-- node "\$HOME\/\.local\/share\/happytohelp-local-agent\/bin\/h2h-local.mjs" mcp$/);
        assert.match(mcpCommand, new RegExp(`^${provider} mcp add happytohelp-local `));
    }
});

test('unsafe workspace and insecure remote server values cannot become setup commands', () => {
    assert.throws(() => buildLocalAgentCommands({ ...options, origin: 'http://example.com' }));
    assert.throws(() => buildLocalAgentCommands({ ...options, projectId: '../../another-config' }));
    assert.throws(() => buildLocalAgentCommands({ ...options, provider: 'codex; id' }));
    assert.doesNotThrow(() => buildLocalAgentCommands({ ...options, origin: 'http://127.0.0.1:8080' }));
});

test('pairing and recently seen devices cannot masquerade as a listening worker', () => {
    assert.equal(isWorkerReady({ online: true, worker_ready: false }), false);
    assert.equal(isWorkerReady({ online: true }), false);
    assert.equal(isWorkerReady({ worker_ready: 'false' }), false);
    assert.equal(isWorkerReady({ worker_ready: true }), true);
    assert.equal(isWorkerReady({ worker_ready: true, revoked_at: '2026-09-08' }), false);
});

test('setup completion matches the actual pairing rather than another ready computer', () => {
    const existing = { id: 'existing', pairing_id: 'old', worker_ready: true };
    const current = { id: 'new', pairing_id: 'current', worker_ready: false };
    assert.equal(pairedDevice([existing, current], 'current'), current);
    assert.equal(pairedDevice([existing], 'current'), null);
    assert.equal(pairedDevice([{ ...current, revoked_at: '2026-09-08' }], 'current'), null);
    assert.equal(pairedDevice([existing], null), null);
});
