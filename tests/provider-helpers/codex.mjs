#!/usr/bin/env node
// Test-only JSONL boundary using installed Codex ErrorNotification/TurnError
// shapes. It does no network work and records the exact turn/start request.
import { createInterface } from 'node:readline';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
if (process.argv[2] === '--version') { console.log('test-codex 1'); process.exit(0); }
const scenario = JSON.parse(await readFile(process.env.H2H_PROVIDER_SCENARIO, 'utf8'));
if (scenario.chatgptLogin) {
  if (process.env.OPENAI_API_KEY !== undefined || process.env.OPENAI_BASE_URL !== undefined) throw new Error('ChatGPT fixture requires no API key or provider override');
  const auth = JSON.parse(await readFile(join(process.env.CODEX_HOME, 'auth.json'), 'utf8'));
  if (auth.auth_mode !== 'chatgpt' || auth.tokens?.access_token !== 'test-only-chatgpt-token') throw new Error('Expected isolated ChatGPT fixture login');
  await appendFile(process.env.H2H_PROVIDER_SCENARIO + '.auth-check', process.argv.slice(2).join(' ') + '\n');
}
if (process.argv[2] === 'login') { console.log(scenario.chatgptLogin ? 'Logged in using ChatGPT' : 'Logged in using an API key (test fixture)'); process.exit(0); }
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  const answer = result => send({ id: request.id, result });
  if (request.method === 'initialize') {
    await writeFile(process.env.H2H_PROVIDER_SCENARIO + '.initialize-request', JSON.stringify(request));
    answer({ userAgent: 'test-only' });
  }
  else if (request.method === 'thread/start' || request.method === 'thread/resume') {
    await writeFile(process.env.H2H_PROVIDER_SCENARIO + '.thread-request', JSON.stringify(request));
    answer({ thread: { id: 'provider-thread' } });
  }
  else if (request.method === 'turn/start') {
    await writeFile(process.env.H2H_PROVIDER_SCENARIO + '.request', JSON.stringify(request));
    await appendFile(process.env.H2H_PROVIDER_SCENARIO + '.calls', 'turn/start\n');
    const error = scenario.error || { message: 'Provider rejected structured output: Missing attachment_ids.', codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 400 } }, additionalDetails: 'prompt: secret context must never be forwarded' };
    const params = { threadId: 'provider-thread', turnId: 'provider-turn' };
    if (scenario.stderr) process.stderr.write(scenario.stderr);
    if (scenario.rpcError) {
      const { message, ...metadata } = error;
      send({ id: request.id, error: { code: -32000, message: scenario.rpcDataOnly ? message : 'private RPC message', data: scenario.rpcDataOnly ? metadata : error } });
      continue;
    }
    if (!scenario.beforeResponse) answer({ turn: { id: 'provider-turn', status: 'inProgress', items: [], error: null } });
    for (const frame of scenario.rawNotifications || []) send(frame);
    if (scenario.frames) {
      for (const frame of scenario.frames) send(frame);
      if (scenario.beforeResponse) answer({ turn: { id: 'provider-turn', status: 'inProgress', items: [], error: null } });
      continue;
    }
    // A different turn must not contaminate the current failure.
    send({ method: 'error', params: { ...params, turnId: 'old-turn', willRetry: false, error: { ...error, codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 503 } } } } });
    if (scenario.notification !== false) send({ method: 'error', params: { ...params, error, willRetry: !!scenario.willRetry } });
    if (scenario.output) send({ method: 'item/completed', params: { ...params, item: { type: 'agentMessage', text: JSON.stringify(scenario.output) } } });
    if (scenario.exitAfterError) { process.exit(1); }
    send({ method: 'turn/completed', params: { threadId: params.threadId, turn: { id: params.turnId, status: scenario.output ? 'completed' : 'failed', items: [], error: scenario.turnError ? error : null } } });
    if (scenario.beforeResponse) answer({ turn: { id: params.turnId, status: 'inProgress', items: [], error: null } });
    if (scenario.exitAfterTerminal) process.exit(0);
  } else if (request.method === 'turn/interrupt') answer({});
  else throw new Error('Unexpected fixture method ' + request.method);
}
