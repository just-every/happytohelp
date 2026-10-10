import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runCodex } from '../lib/providers/codex-app-server.mjs';
import { codexProviderError } from '../lib/providers/codex-error.mjs';
import { validateAgentOutput } from '../lib/result.mjs';
import { redactDiagnostic } from '../lib/provider-error.mjs';
import { providerFixture, strictOutput } from '../../tests/provider-helpers/fixture.mjs';
const request = { prompt: 'Private assignment content', workingDirectory: process.cwd(), model: 'gpt-6.1-sol' };
const errorFor = (status, variant = 'httpConnectionFailed') => ({ message: 'Invalid schema: Missing attachment_ids.', codexErrorInfo: { [variant]: { httpStatusCode: status } }, additionalDetails: 'prompt: private assignment' });

test('fresh Codex threads explicitly opt into native accounting without exposing raw notifications', async () => {
  const params = { threadId: 'provider-thread', turnId: 'provider-turn' };
  const fixture = await providerFixture({ output: strictOutput, beforeResponse: true, notification: false, rawNotifications: [
    { method: 'rawResponse/completed', params: { ...params, responseId: 'test-response', usage: null, usageMetadata: { amount: null, metadata: 'PRIVATE_USAGE_METADATA' } } },
    { method: 'rawResponseItem/completed', params: { ...params, item: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'PRIVATE_RESPONSE_BODY' }] } } },
  ] });
  const progress = [], identities = [];
  try {
    const result = await runCodex({ ...request, onProgress: value => progress.push(value), onIdentity: value => identities.push(value) });
    const initialize = JSON.parse(await readFile(fixture.path + '.initialize-request', 'utf8'));
    const thread = JSON.parse(await readFile(fixture.path + '.thread-request', 'utf8'));
    const turn = JSON.parse(await readFile(fixture.path + '.request', 'utf8'));
    assert.deepEqual(initialize.params.capabilities, { experimentalApi: true });
    assert.equal(thread.params.experimentalRawEvents, true);
    assert.equal(thread.params.model, request.model);
    assert.equal(turn.params.model, request.model);
    assert.equal(thread.params.modelProvider, undefined);
    assert.deepEqual(JSON.parse(result.rawText), strictOutput);
    assert.doesNotMatch(JSON.stringify({ result, progress, identities }), /PRIVATE_/);
    assert.equal((await readFile(fixture.path + '.calls', 'utf8')).trim(), 'turn/start');
  } finally { await fixture.close(); }
});

test('installed Codex other/error JSON notifications retain the provider reason without inventing an HTTP status', async () => {
  // Captured from Codex 0.159.3 against a local provider. Only thread/turn IDs
  // were replaced and notification timestamps omitted. No stderr was emitted.
  const frames = JSON.parse(await readFile(new URL('../../tests/provider-helpers/observed-codex-error.json', import.meta.url), 'utf8'));
  const message = JSON.parse(frames[0].params.error.message).error.message;
  for (const scenario of [{ frames }, { frames: frames.slice(1), beforeResponse: true }]) {
    const fixture = await providerFixture(scenario);
    try {
      await assert.rejects(runCodex(request), error => {
        assert.deepEqual(error.provider_error, { provider: 'codex', http_status: null, message });
        assert.match(error.provider_error.message, /Missing 'attachment_ids'/);
        assert.doesNotMatch(error.message, /HTTP 400/);
        return true;
      });
      assert.equal((await readFile(fixture.path + '.calls', 'utf8')).trim(), 'turn/start');
    } finally { await fixture.close(); }
  }
  const envelope = { message: JSON.stringify({ error: { type: 'invalid_request_error', message: 'Invalid schema. Bearer BODY_SECRET\nprompt: BODY_CONTEXT' }, request: 'UNSAFE_EXTRA' }), codexErrorInfo: 'other' };
  assert.deepEqual(codexProviderError(envelope), { provider: 'codex', http_status: null, message: 'Invalid schema. [credential removed] [private context removed]' });
  assert.equal(codexProviderError({ ...envelope, codexErrorInfo: 'sandboxError' }), null);
  assert.equal(codexProviderError({ codexErrorInfo: 'other', message: JSON.stringify({ error: { message: 'Local failure', type: 'filesystem_error' } }) }), null);
  for (const status of [400, 401, 429, 500, 503]) assert.equal(codexProviderError({ ...envelope, codexErrorInfo: { httpConnectionFailed: { httpStatusCode: status } } }).http_status, status);
});

test('actual turn/start outputSchema requires every declared property recursively; strict empty values and legacy results work', async () => {
  const fixture = await providerFixture({ output: strictOutput, beforeResponse: true, willRetry: true });
  try {
    const result = await runCodex(request);
    const { params } = JSON.parse(await readFile(fixture.path + '.request', 'utf8'));
    const visit = schema => {
      if (schema.type === 'object') {
        assert.equal(schema.additionalProperties, false);
        assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
        Object.values(schema.properties).forEach(visit);
      }
      if (schema.items) visit(schema.items);
    };
    visit(params.outputSchema);
    assert.equal(params.model, 'gpt-6.1-sol');
    assert.deepEqual(JSON.parse(result.rawText), strictOutput);
    assert.deepEqual(validateAgentOutput(strictOutput).result.replies, []);
    const legacy = { status: 'completed', summary: 'Checked', actions: [], verified: true, question: null, reply_draft: 'Authorized reply' };
    assert.equal(validateAgentOutput(legacy).result.reply_draft, 'Authorized reply');
    const authorized = validateAgentOutput({ ...strictOutput, reply_draft: 'Authorized reply' }, { mode: 'resolve_reply' }).result;
    assert.equal(Object.hasOwn(authorized, 'replies'), false, 'strict empty proposals retain the authorized legacy delivery contract');
    assert.throws(() => validateAgentOutput({ ...strictOutput, verified: false }), /must be verified/);
    assert.throws(() => validateAgentOutput({ ...strictOutput, attachment_ids: ['not-a-uuid'] }), /attachment UUIDs/);
  } finally { await fixture.close(); }
});

test('native errors survive original error-before-terminal ordering, early notifications, terminal errors, RPC rejection and child exit', async () => {
  for (const scenario of [
    { error: errorFor(400), beforeResponse: true },
    { error: errorFor(400), beforeResponse: true, exitAfterError: true },
    { error: errorFor(401), turnError: true, notification: false },
    { error: errorFor(429, 'responseStreamConnectionFailed') },
    { error: errorFor(200, 'responseStreamDisconnected') },
    { error: errorFor(500, 'responseStreamDisconnected'), exitAfterError: true },
    { error: errorFor(503, 'responseTooManyFailedAttempts'), beforeResponse: true, exitAfterTerminal: true },
    { error: { message: 'HTTP request failed', httpResponseStatusCode: 502 }, rpcError: true },
    { error: errorFor(429), rpcError: true, rpcDataOnly: true },
  ]) {
    const fixture = await providerFixture(scenario);
    try {
      await assert.rejects(runCodex(request), error => {
        const expected = codexProviderError(scenario.error);
        assert.deepEqual(error.provider_error, expected);
        assert.match(error.message, new RegExp('HTTP ' + expected.http_status));
        return true;
      });
      assert.equal((await readFile(fixture.path + '.calls', 'utf8')).trim(), 'turn/start', 'one attempt only');
    } finally { await fixture.close(); }
  }
});

test('codes never invent an HTTP status and nonprovider failures never acquire provider evidence', async () => {
  assert.equal(codexProviderError({ message: 'Bad request HTTP 400', codexErrorInfo: 'badRequest' }).http_status, null);
  assert.equal(codexProviderError({ message: 'Sandbox error HTTP 400', codexErrorInfo: 'sandboxError' }), null);
  const fixture = await providerFixture({ error: { message: 'prompt: private assignment', codexErrorInfo: 'sandboxError' }, stderr: 'Authorization: Bearer stderr-secret\nprompt: full private task\n' });
  const progress = [];
  try {
    await assert.rejects(runCodex({ ...request, onProgress: message => progress.push(message) }), error => {
      assert.equal(error.provider_error, undefined);
      assert.doesNotMatch(error.message, /private assignment|stderr-secret|full private task/);
      return true;
    });
    assert.doesNotMatch(progress.join('\n'), /stderr-secret|private task/);
  } finally { await fixture.close(); }
});

test('provider excerpts redact credentials and sensitive context before truncation', async () => {
  const message = 'Missing attachment_ids. https://user:URL_PASSWORD@example.test/v1/responses?api_key=QUERY_SECRET#HASH_SECRET\nBearer BEARER_SECRET\napi_key="API_SECRET" token=TOKEN_SECRET password=PASSWORD_SECRET\nCookie: SESSION_SECRET\nsk-testSECRET\neyJhbGciOiJub25lIn0.eyJzZWNyZXQiOiJqd3QifQ.signature\nprompt: CUSTOMER_PRIVATE';
  const safe = redactDiagnostic(message);
  assert.match(safe, /Missing attachment_ids/);
  assert.match(safe, /https:\/\/example.test\/v1\/responses/);
  assert.doesNotMatch(safe, /URL_PASSWORD|QUERY_SECRET|HASH_SECRET|BEARER_SECRET|API_SECRET|TOKEN_SECRET|PASSWORD_SECRET|SESSION_SECRET|testSECRET|eyJ|CUSTOMER_PRIVATE/);
  assert.ok(redactDiagnostic('Invalid schema. Bearer ' + 'x'.repeat(1200)).length <= 600);
  const fixture = await providerFixture({ error: { ...errorFor(400), message }, stderr: 'Bearer STDERR_PRIVATE' });
  try {
    await assert.rejects(runCodex(request), error => {
      assert.equal(error.provider_error.message, safe);
      assert.doesNotMatch(JSON.stringify(error), /SECRET|PRIVATE/);
      return true;
    });
  } finally { await fixture.close(); }
});
