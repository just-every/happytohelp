import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { connectProvider, discoverProviders, PROVIDER_COMMANDS } from '../scripts/installer/providers.mjs';

async function fakePath() {
  const directory = await mkdtemp(join(tmpdir(), 'rer-installer-providers-'));
  for (const name of ['wrangler', 'gh', 'git']) {
    const file = join(directory, name);
    await writeFile(file, '#!/bin/sh\nexit 0\n');
    await chmod(file, 0o755);
  }
  return { directory, env: { PATH: directory } };
}

test('provider command plans are fixed browser actions', () => {
  assert.deepEqual(PROVIDER_COMMANDS.cloudflare.connect, ['login']);
  assert.deepEqual(PROVIDER_COMMANDS.github.connect, ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web']);
  assert.equal(Object.isFrozen(PROVIDER_COMMANDS.cloudflare), true);
  assert.equal(Object.isFrozen(PROVIDER_COMMANDS.github), true);
});

test('discovery parses safe account and repository metadata without exposing command output', async t => {
  const { directory, env } = await fakePath();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [];
  const run = async (file, args) => {
    calls.push([file, args]);
    if (args[0] === '--version') return { code: 0, stdout: 'tool 1.2.3\n', stderr: '' };
    if (args[0] === 'whoami') return { code: 0, stdout: 'Account Name: Example\nAccount ID: 0123456789abcdef0123456789abcdef\n', stderr: '' };
    if (args[0] === 'auth') return { code: 0, stdout: 'Logged in\n', stderr: '' };
    if (args[0] === 'api') return { code: 0, stdout: '{"login":"octocat","id":583231,"name":"The Octocat"}\n', stderr: '' };
    if (args[0] === 'config') return { code: 0, stdout: 'git@github.com:example-org/support-app.git\n', stderr: '' };
    if (args[0] === 'repo') return { code: 0, stdout: '{"nameWithOwner":"example-org/support-app","isPrivate":true,"defaultBranchRef":{"name":"main"},"pushedAt":"2026-09-16T00:00:00Z"}\n', stderr: '' };
    throw new Error(`Unexpected command ${args.join(' ')}`);
  };
  const result = await discoverProviders(directory, { env, run });
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.providers.cloudflare.accounts, [{ id: '0123456789abcdef0123456789abcdef', name: 'Example' }]);
  assert.deepEqual(result.providers.github.account, { login: 'octocat', id: '583231', name: 'The Octocat' });
  assert.deepEqual(result.providers.github.repository, {
    nameWithOwner: 'example-org/support-app', isPrivate: true, defaultBranch: 'main', pushedAt: '2026-09-16T00:00:00Z',
  });
  assert.equal('stdout' in result.providers.cloudflare, false);
  assert.equal('stderr' in result.providers.github, false);
  assert.equal(calls.some(([, args]) => args.includes('login')), false);
});

test('connectProvider runs only the fixed login and confirms by refreshed discovery', async t => {
  const { directory, env } = await fakePath();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [];
  let authenticated = false;
  const run = async (file, args) => {
    calls.push([file, args]);
    if (args[0] === 'login') { authenticated = true; return { code: 0, stdout: 'browser opened\n', stderr: '' }; }
    if (args[0] === '--version') return { code: 0, stdout: 'wrangler 4.45.4\n', stderr: '' };
    if (args[0] === 'whoami') return { code: authenticated ? 0 : 1, stdout: authenticated ? 'Logged in\n' : '', stderr: authenticated ? '' : 'Not logged in\n' };
    if (args[0] === 'auth') return { code: 1, stdout: '', stderr: 'Not logged in\n' };
    throw new Error(`Unexpected command ${args.join(' ')}`);
  };
  const progress = [];
  const result = await connectProvider(directory, 'cloudflare', { env, run, onProgress: event => progress.push(event) });
  assert.equal(result.state, 'connected');
  assert.deepEqual(result.operation, { state: 'connected' });
  assert.deepEqual(calls.map(([, args]) => args), [['login'], ['--version'], ['whoami'], ['--version'], ['auth', 'status', '--hostname', 'github.com']]);
  assert.deepEqual(progress.map(event => event.state), ['awaiting_browser', 'refreshing', 'connected']);
});

test('real child device flow exposes only the one-time code and accepts browser-open prompt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rer-device-flow-'));
  const script = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2).join(' ');
if (args.startsWith('auth login')) {
 process.stderr.write('First copy your one-time code: ABCD-1234\\nprivate fixture credential ghp_do_not_expose\\n');
 process.stdin.once('data', () => { fs.writeFileSync(process.env.TEST_STATE, 'connected'); process.exit(0); });
} else if(args.startsWith('auth status')) process.exit(fs.existsSync(process.env.TEST_STATE) ? 0 : 1);
else if(args.startsWith('api user')) console.log(JSON.stringify({login:'fixture',id:123}));
else console.log('gh version fixture');
`;
  await writeFile(join(directory, 'gh'), script, { mode: 0o700 });
  const progress = [];
  try {
    const result = await connectProvider(directory, 'github', {
      env: { PATH: directory, TEST_STATE: join(directory, 'authenticated') },
      onProgress: value => progress.push(value),
    });
    assert.equal(result.authenticated, true);
    assert.ok(progress.some(value => value.deviceCode === 'ABCD-1234' && value.verificationUrl === 'https://github.com/login/device'));
    assert.equal(JSON.stringify({result,progress}).includes('ghp_do_not_expose'), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
