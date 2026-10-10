import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
const configuration = source.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');

test('Verify push gate covers main and the 0.3 integration release only', () => {
  const events = configuration.match(/^on:\n([\s\S]*?)(?=^\S)/m)?.[1];
  assert.ok(events, 'workflow must declare events');
  const push = events.match(/^  push:\n([\s\S]*?)(?=^  \S|$)/m)?.[1];
  assert.ok(push, 'push verification must be enabled');
  const branches = push.match(/^    branches: \[([^\]]+)\]$/m)?.[1];
  assert.ok(branches, 'push must have an explicit branch allowlist');
  assert.deepEqual(branches.split(',').map(branch => branch.trim()), ['main', 'release/0.3.x']);
  assert.doesNotMatch(push, /branches-ignore:|paths:|paths-ignore:|tags:/);
  assert.match(events, /^  pull_request:$/m);
  assert.match(events, /^  workflow_dispatch:$/m);
});

test('Verify has read-only source access and no deployment or secret authority', () => {
  const permissions = configuration.match(/^permissions:\n([\s\S]*?)(?=^\S)/m)?.[1];
  assert.equal(permissions?.trim(), 'contents: read');
  assert.equal((configuration.match(/^\s*permissions:/gm) || []).length, 1, 'jobs cannot override read-only permissions');
  const jobs = configuration.match(/^jobs:\n([\s\S]*)$/m)?.[1];
  assert.ok(jobs);
  assert.deepEqual([...jobs.matchAll(/^  ([\w-]+):$/gm)].map(match => match[1]), ['verify']);
  assert.doesNotMatch(configuration, /\bsecrets\s*[.\[]|^\s*environment:|\bid-token:|\bwrite-all\b/gm);
  assert.doesNotMatch(configuration, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|H2H_SETUP_TOKEN|EVIDENCE_WRITE_TOKEN/);
  assert.doesNotMatch(configuration, /(?:pnpm|npm|wrangler|gh)\s+(?:run\s+)?(?:deploy|publish|workflow\s+(?:run|enable))\b|scripts\/(?:deploy|delivery)\b/);
  const actions = [...configuration.matchAll(/^\s*(?:- )?uses: (\S+)$/gm)].map(match => match[1].split('@')[0]);
  assert.deepEqual(actions, ['actions/checkout', 'pnpm/action-setup', 'actions/setup-node', 'actions/upload-artifact', 'actions/upload-artifact']);
  assert.match(configuration, /persist-credentials: false/);
  assert.match(configuration, /run: pnpm run verify\n/);
  assert.match(configuration, /run: git diff --exit-code && test -z/);
});
