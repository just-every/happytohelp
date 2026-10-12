import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { LocalRunner } from '../local-agent/lib/runner.mjs';
import { newConfig } from '../local-agent/lib/config.mjs';
import { LocalAgentApi } from '../local-agent/lib/api.mjs';
import { providerFixture, strictOutput } from './provider-helpers/fixture.mjs';
import { checkUnmarkedFailures } from './provider-helpers/unmarked-failures.mjs';
import { migrationStatements } from './helpers/migration-statements.mjs';
const packages = await readdir('node_modules/.pnpm');
const { Miniflare, convertV4MiniflareOptions } = await import('../node_modules/.pnpm/' + packages.find(x => x.startsWith('miniflare@')) + '/node_modules/miniflare/dist/src/index.js');

test('real runner and native D1 persist provider errors; malicious payloads are redacted, bounded, scoped and never send or replay', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'h2h-provider-native-'));
  await build({ entryPoints: ['tests/local-computer-worker.ts'], outfile: join(directory, 'worker.mjs'), bundle: true, format: 'esm', platform: 'neutral', external: ['node:crypto', 'node:buffer'], logLevel: 'silent' });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: await readFile(join(directory, 'worker.mjs'), 'utf8'), compatibilityDate: '2026-09-01', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['FILES'], queueProducers: { JOBS: 'test-only' } }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of ['0001_identity.sql', '0002_conversations.sql', '0004_message_intent.sql', '0005_widget_identity.sql', '030_local_computer.sql', '0070_management.sql', '0050_knowledge.sql', '020_ai_support.sql', '112_conversation_outcomes.sql']) {
      for (const sql of migrationStatements(await readFile('migrations/' + file, 'utf8'))) await db.prepare(sql).run();
    }
    await db.batch([
      db.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','http://localhost',1)"),
      db.prepare("INSERT INTO users VALUES('u','owner@provider.test','Owner',1)"),
      db.prepare("INSERT INTO memberships VALUES('p','u','owner')"),
      db.prepare("INSERT INTO contacts(id,project_id,name,email,external_id,created_at) VALUES('contact','p','Customer','customer@provider.test',NULL,1)"),
      db.prepare("INSERT INTO conversations VALUES('c','p','contact',0,NULL,NULL,NULL,1,1)"),
      db.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(createHash('sha256').update('operator').digest('hex'), Date.now() + 1000000),
    ]);
    const request = async (path, body, token = 'operator', method = 'POST') => {
      const response = await mf.dispatchFetch('http://localhost' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, ...await response.json() };
    };
    const pairing = await request('/api/projects/p/local-agents/pairings', {});
    const paired = await request('/api/local-agents/pair', { code: pairing.data.code, name: 'Provider fixture', provider: 'codex', capabilities: ['terminal'] });
    assert.equal(paired.status, 200);
    const token = paired.data.token, device = paired.data.device.id;
    const jobsPath = '/api/projects/p/conversations/c/delegations';
    const api = new LocalAgentApi({ server: 'http://localhost', token, fetchImpl: (url, options) => mf.dispatchFetch(url, options) });
    for (const status of [400, 401, 429, 500, 503]) {
      const queued = await request(jobsPath, { device_id: device, mode: 'resolve_reply', instructions: 'Inspect only; do not send', request_id: 'status-' + status });
      assert.equal(queued.status, 200);
      const fixture = await providerFixture({ beforeResponse: true, error: { message: 'Invalid schema: Missing attachment_ids. api_key=PRIVATE_API\nprompt: PRIVATE_CONTEXT', codexErrorInfo: { httpConnectionFailed: { httpStatusCode: status } }, additionalDetails: 'PRIVATE_DETAILS' }, stderr: 'Bearer PRIVATE_STDERR', rawNotifications: [{ method: 'rawResponse/completed', params: { threadId: 'provider-thread', turnId: 'provider-turn', responseId: 'test-response', usage: null, usageMetadata: { amount: null, metadata: 'PRIVATE_RAW_ACCOUNTING' } } }] });
      try {
        const config = newConfig({ server: 'http://localhost', token, device: paired.data.device, provider: 'codex', name: 'Fixture', workingDirectory: directory });
        const logs = [];
        const runner = new LocalRunner(config, { configPath: join(directory, 'connector.json'), log: message => logs.push(message) });
        runner.api = api;
        await assert.rejects(runner.run({ once: true }), error => error.provider_error?.http_status === status);
        await runner.run({ once: true });
        assert.equal((await readFile(fixture.path + '.calls', 'utf8')).trim(), 'turn/start');
        const rows = await request(jobsPath, undefined, 'operator', 'GET');
        const job = rows.data.find(row => row.id === queued.data.id);
        assert.equal(job.status, 'failed'); assert.equal(job.result.verified, false);
        assert.equal(job.result.provider_error.http_status, status);
        assert.match(job.result.provider_error.message, /Missing attachment_ids/);
        const persisted = await db.prepare('SELECT result FROM local_jobs WHERE id=?').bind(job.id).first();
        assert.deepEqual(JSON.parse(persisted.result).provider_error, job.result.provider_error);
        const events = await db.prepare("SELECT payload FROM local_events WHERE job_id=? AND kind='result'").bind(job.id).all();
        assert.equal(events.results.length, 1);
        const original = JSON.parse(events.results[0].payload);
        const claim = await db.prepare('SELECT run_id FROM local_jobs WHERE id=?').bind(job.id).first();
        const event = await db.prepare("SELECT event_id FROM local_events WHERE job_id=? AND kind='result'").bind(job.id).first();
        assert.equal((await request('/api/local-agents/jobs/' + job.id + '/result', { ...original, run_id: claim.run_id, event_id: event.event_id }, token)).status, 200);
        assert.doesNotMatch(JSON.stringify({ persisted, events, logs, config }), /PRIVATE_/);
      } finally { await fixture.close(); }
    }
    const queued = await request(jobsPath, { device_id: device, mode: 'resolve_reply', instructions: 'Untrusted connector test', request_id: 'malicious' });
    const claim = await api.claim({ claim_id: 'malicious' });
    const endpoint = '/api/local-agents/jobs/' + queued.data.id + '/result';
    const body = { run_id: claim.run_id, event_id: 'malicious', status: 'failed', result: { summary: 'PRIVATE_SUMMARY', actions: [{ description: 'PRIVATE_ACTION', evidence: 'PRIVATE_EVIDENCE' }], verified: false, reply_draft: 'PRIVATE_REPLY', replies: [{ id: 'send', body: 'PRIVATE_PROPOSAL' }], unexpected: 'PRIVATE_EXTRA', provider_error: { provider: 'codex', http_status: 400, message: 'Invalid schema. https://PRIVATE_USER:PRIVATE_PASSWORD@example.test/api?token=PRIVATE_QUERY#PRIVATE_HASH\nBearer PRIVATE_BEARER\nCookie: PRIVATE_COOKIE\n' + 'x'.repeat(900) + '\nprompt: PRIVATE_PROMPT' } } };
    for (const invalid of [{ http_status: '400' }, { http_status: 99 }, { http_status: 600 }, { provider: 'untrusted' }, { message: 'x'.repeat(8001) }, { extra: 'PRIVATE_EXTRA' }]) {
      const attempted = structuredClone(body); Object.assign(attempted.result.provider_error, invalid);
      assert.equal((await request(endpoint, attempted, token)).status, 422);
    }
    assert.equal((await request(endpoint, { ...body, status: 'completed' }, token)).status, 422);
    assert.equal((await request(endpoint, { ...body, run_id: 'wrong' }, token)).status, 409);
    assert.equal((await request(endpoint, body, 'wrong-device')).status, 401);
    const admitted = await request(endpoint, body, token); assert.equal(admitted.status, 200);
    assert.doesNotMatch(JSON.stringify(admitted), /PRIVATE_/);
    assert.match(admitted.data.result.provider_error.message, /Invalid schema/);
    const stored = await db.prepare('SELECT result FROM local_jobs WHERE id=?').bind(queued.data.id).first();
    const events = await db.prepare('SELECT payload FROM local_events WHERE job_id=?').bind(queued.data.id).all();
    assert.doesNotMatch(JSON.stringify({ stored, events }), /PRIVATE_/);
    assert.ok(admitted.data.result.provider_error.message.length <= 600);
    for (const table of ['messages', 'local_receipts', 'local_result_effects']) assert.equal((await db.prepare('SELECT COUNT(*) n FROM ' + table).first()).n, 0, table + ' must stay empty');
    await t.test('unmarked failed/cancelled diagnostics retain partial work with no secrets, proposals, effects or replay', () => checkUnmarkedFailures({ request, api, db, jobsPath, device, token }));
    // Provider strict output keeps the historical advance-authorized delivery
    // behavior, but ordinary Resolve still cannot send a message.
    for (const mode of ['resolve', 'resolve_reply']) {
      const created = await request(jobsPath, { device_id: device, mode, instructions: 'Verify the test state', request_id: 'strict-' + mode });
      assert.equal(created.status, 200);
      const fixture = await providerFixture({ output: { ...strictOutput, reply_draft: 'Advance-authorized verified response' } });
      try {
        const config = newConfig({ server: 'http://localhost', token, device: paired.data.device, provider: 'codex', name: 'Fixture', workingDirectory: directory });
        const runner = new LocalRunner(config, { configPath: join(directory, 'strict-connector.json') }); runner.api = api;
        await runner.run({ once: true });
        assert.equal((await db.prepare('SELECT COUNT(*) n FROM messages').first()).n, mode === 'resolve_reply' ? 1 : 0);
        assert.equal((await db.prepare('SELECT status FROM local_jobs WHERE id=?').bind(created.data.id).first()).status, 'completed');
      } finally { await fixture.close(); }
    }
    await t.test('legitimate needs_input and completed reports retain their full content and existing delivery authority', async () => {
      const queued = await request(jobsPath, { device_id: device, mode: 'resolve', instructions: 'Preserve the operator report', request_id: 'ordinary-report' });
      const claim = await api.claim({ claim_id: 'ordinary-report' });
      for (const status of ['needs_input', 'completed']) {
        const result = { summary: 'Input: the operator chose a support option.', actions: [{ description: 'Read credential documentation', evidence: 'Confirmed the documented instructions.' }], verified: status === 'completed', reply_draft: 'Your request is ready for review.', question: 'May I continue?', replies: [{ id: 'review', title: 'Review reply', body: 'The configuration is correct.' }], follow_up_actions: [{ id: 'inspect', title: 'Inspect again', instructions: 'Check the current configuration.', mode: 'investigate' }] };
        const admitted = await request('/api/local-agents/jobs/' + queued.data.id + '/result', { run_id: claim.run_id, event_id: 'ordinary-' + status, status, result }, token);
        assert.equal(admitted.status, 200);
        assert.equal(admitted.data.status, status);
        assert.deepEqual(admitted.data.result, result);
      }
      assert.equal((await db.prepare('SELECT COUNT(*) n FROM messages').first()).n, 1, 'ordinary Resolve adds no customer message');
    });
    await db.prepare("DELETE FROM memberships WHERE project_id='p'").run();
    assert.equal((await request(jobsPath, undefined, 'operator', 'GET')).status, 401);
    assert.equal((await request(endpoint, body, token)).status, 403);
  } finally { await mf.dispose(); await rm(directory, { recursive: true, force: true }); }
});
