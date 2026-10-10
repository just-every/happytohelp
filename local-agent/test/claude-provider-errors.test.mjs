import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { runClaude } from '../lib/providers/claude-cli.mjs';
import { providerFixture } from '../../tests/provider-helpers/fixture.mjs';

test('Claude stream-json API status and redacted excerpt survive terminal failure without raw stderr', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-only-no-network';
  try {
    for (const status of [400, 401, 429, 503, null]) {
      const category = status === 401 ? 'authentication_failed' : status === 429 ? 'rate_limit' : status >= 500 ? 'server_error' : 'invalid_request';
      const events = [
        ...(status ? [{ type: 'system', subtype: 'api_retry', error_status: status, error: category, attempt: 1, max_retries: 1, retry_delay_ms: 0, uuid: 'fixture-retry', session_id: 'fixture-session' }] : []),
        { type: 'assistant', error: category, message: { content: [{ type: 'text', text: 'Invalid provider request. Bearer PRIVATE_BEARER' }] } },
        { type: 'result', subtype: 'error_during_execution', errors: ['prompt: PRIVATE_ASSIGNMENT'] },
      ];
      const fixture = await providerFixture({ events, code: 1, stderr: 'Cookie: PRIVATE_COOKIE\nprompt: PRIVATE_ASSIGNMENT' });
      try {
        const target = new URL('../../tests/provider-helpers/claude.mjs', import.meta.url).pathname;
        await chmod(target, 0o755); await symlink(target, join(fixture.directory, 'claude'));
        await assert.rejects(runClaude({ prompt: 'Private task', workingDirectory: fixture.directory }), error => {
          assert.equal(error.provider_error.provider, 'claude');
          assert.equal(error.provider_error.http_status, status);
          assert.match(error.provider_error.message, /Invalid provider request/);
          assert.doesNotMatch(JSON.stringify(error), /PRIVATE/);
          return true;
        });
      } finally { await fixture.close(); }
    }
  } finally { if (previous === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previous; }
});

test('Claude success clears transient errors and a later no-response error does not inherit an earlier HTTP status', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-only-no-network';
  try {
    for (const scenario of [
      { events: [{ type: 'system', subtype: 'api_retry', error_status: 503, error: 'server_error' }, { type: 'assistant', message: { content: [] } }, { type: 'result', subtype: 'success', structured_output: { summary: 'Recovered' } }], success: true },
      { events: [{ type: 'system', subtype: 'api_retry', error_status: 503, error: 'server_error' }, { type: 'system', subtype: 'api_retry', error_status: null, error: 'unknown' }, { type: 'result', subtype: 'error_during_execution' }], code: 1, provider: true },
      { events: [{ type: 'result', subtype: 'error_max_turns' }], code: 1, stderr: 'prompt: PRIVATE_TASK\nBearer PRIVATE_TOKEN' },
    ]) {
      const fixture = await providerFixture(scenario);
      try {
        const target = new URL('../../tests/provider-helpers/claude.mjs', import.meta.url).pathname;
        await chmod(target, 0o755); await symlink(target, join(fixture.directory, 'claude'));
        const run = runClaude({ prompt: 'Private task', workingDirectory: fixture.directory });
        if (scenario.success) assert.equal(JSON.parse((await run).rawText).summary, 'Recovered');
        else await assert.rejects(run, error => {
          assert.equal(error.provider_error?.http_status, scenario.provider ? null : undefined);
          assert.doesNotMatch(error.message, /PRIVATE/);
          return true;
        });
      } finally { await fixture.close(); }
    }
  } finally { if (previous === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previous; }
});
