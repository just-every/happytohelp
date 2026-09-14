import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { chmod, mkdtemp, realpath, stat, writeFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalAgentApi } from '../lib/api.mjs';
import { codexLoginStatus, probeBrowserMcp, runtimeCapabilities } from '../lib/capabilities.mjs';
import { acquireConfigLock, newConfig, readConfig, writeConfig } from '../lib/config.mjs';
import { ConnectorError } from '../lib/errors.mjs';
import { serveMcp } from '../lib/mcp.mjs';
import { LocalRunner } from '../lib/runner.mjs';
import { validateAgentOutput } from '../lib/result.mjs';
import { assertServerUrl } from '../lib/util.mjs';
import { buildClaudeArgs, structuredOutputFromClaudeEvent } from '../lib/providers/claude-cli.mjs';
import { parseArguments } from '../bin/h2h-local.mjs';
import { connect, hasPairingOptions } from '../lib/setup.mjs';
import { friendlyError, readyMessage, statusMessage } from '../lib/terminal.mjs';

async function testServer({
  resultResponse = { accepted: true }, resultStatus = 200,
  heartbeatStatus = 200, heartbeatResponse,
  contextResponse = { conversation: { id: 'c-1' } }, contextStatus = 200, claimResponse,
} = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const parsedBody = body && request.headers['content-type']?.includes('application/json') ? JSON.parse(body) : body || null;
    requests.push({ method: request.method, path: request.url, headers: request.headers, body: parsedBody });
    const send = (data, status = 200) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data }));
    };
    if (request.url === '/api/local-agents/heartbeat') {
      if (heartbeatStatus !== 200) {
        response.writeHead(heartbeatStatus, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Device revoked.' }));
        return;
      }
      return send(typeof heartbeatResponse === 'function'
        ? heartbeatResponse(requests)
        : (heartbeatResponse || { device: { id: 'device-1' }, cancel_requested: false, input_messages: [] }));
    }
    if (request.url === '/api/local-agents/claim') return send(claimResponse ? claimResponse(requests) : {
      id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Update the account address.', context: { conversation: { id: 'c-1' } },
    });
    if (/^\/api\/local-agents\/jobs\/[^/]+\/result$/.test(request.url)) {
      const status = typeof resultStatus === 'function' ? resultStatus(requests) : resultStatus;
      if (status !== 200) {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Result validation is temporarily unavailable.' }));
        return;
      }
      return send(typeof resultResponse === 'function' ? resultResponse(requests) : resultResponse);
    }
    if (/^\/api\/local-agents\/jobs\/[^/]+\/progress$/.test(request.url)) return send({ accepted: true });
    if (/^\/api\/local-agents\/jobs\/[^/]+\/attachments$/.test(request.url)) return send({
      id: '5c01791a-a710-4d70-aad6-82c575da7c2e', url: '/storage/evidence.png', preview_url: '/storage/evidence-preview.png',
      aggregate_type: 'image', filename_original: 'evidence.png', size: 8,
    });
    if (/^\/api\/local-agents\/jobs\/[^/]+\/context\?run_id=/.test(request.url)) {
      if (contextStatus !== 200) {
        response.writeHead(contextStatus, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Fresh evidence is temporarily unavailable.' }));
        return;
      }
      return send(contextResponse);
    }
    return send({ message: 'not found' }, 404);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    requests,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function completedOutput() {
  return {
    status: 'completed',
    summary: 'Address was updated.',
    actions: [{ description: 'Updated the address.', evidence: 'Account record now shows the supplied address.' }],
    reply_draft: 'I have updated your address.',
    verified: true,
    question: null,
  };
}

function needsInputResult() {
  return {
    summary: 'A decision is required.',
    actions: [],
    reply_draft: '',
    verified: false,
    question: 'Which legal entity should receive the invoice?',
  };
}

async function availableDirectRuntime(config) {
  return {
    capabilities: ['mcp', `runtime:${config.provider}`, 'direct_runner'],
    details: {
      provider: config.provider,
      providerAvailable: true,
      directRunnerAvailable: true,
      browser: config.browserHealth || null,
      codexAuthenticated: config.provider === 'codex',
    },
  };
}

async function unavailableDirectRuntime(config) {
  return {
    capabilities: ['mcp', `runtime:${config.provider}`],
    details: {
      provider: config.provider,
      providerAvailable: false,
      directRunnerAvailable: false,
      directRunnerReason: `${config.provider} direct runner is unavailable.`,
      browser: config.browserHealth || null,
    },
  };
}

test('server URL policy rejects remote HTTP and accepts loopback tests', () => {
  assert.equal(assertServerUrl('http://127.0.0.1:8090/'), 'http://127.0.0.1:8090');
  assert.throws(() => assertServerUrl('http://support.example.test'), ConnectorError);
  assert.throws(() => assertServerUrl('https://user:secret@example.test'), ConnectorError);
});

test('start defaults to a fresh Codex pairing and terminal messages distinguish readiness from status', () => {
  const start = parseArguments(['start', '--server', 'https://support.example.test', '--code', 'pair-1', '--name', 'Mina’s Mac']);
  assert.equal(start.command, 'start');
  assert.equal(start.options.provider, undefined);
  assert.equal(hasPairingOptions(start.options), true);
  assert.equal(hasPairingOptions({ once: true }), false);
  assert.match(readyMessage({ provider: 'codex' }), /Ready — Codex is connected/);
  const status = statusMessage({
    provider: 'codex', model: null, directRunnerAvailable: true,
    browser: { configured: false }, active: null,
  });
  assert.match(status, /Worker: not checked by status/);
  assert.doesNotMatch(status, /device-token/);
  assert.match(friendlyError(new ConnectorError('missing', { code: 'CONFIG_MISSING' })), /setup command/);
});

test('an unauthenticated Codex runtime is not advertised as a direct worker', async () => {
  const config = newConfig({
    server: 'http://127.0.0.1:8090', token: 'device-token', device: { id: 'device-1' },
    provider: 'codex', name: 'test', workingDirectory: process.cwd(),
  });
  const report = await runtimeCapabilities(config, {
    commandExistsFn: async () => true,
    codexLoginStatusFn: async () => ({ authenticated: false, reason: 'Codex is not signed in. Run `codex login`, then start the local agent again.' }),
  });
  assert.equal(report.details.directRunnerAvailable, false);
  assert.match(report.details.directRunnerReason, /codex login/);
  assert.equal(report.capabilities.includes('direct_runner'), false);
});

test('Codex login preflight is cached for worker heartbeats and can be forced by status', async () => {
  const config = newConfig({
    server: 'http://127.0.0.1:8090', token: 'device-token', device: { id: 'device-1' },
    provider: 'codex', name: 'test', workingDirectory: process.cwd(),
  });
  let loginChecks = 0;
  const options = {
    commandExistsFn: async () => true,
    codexLoginStatusFn: async () => {
      loginChecks += 1;
      return { authenticated: true };
    },
  };
  await runtimeCapabilities(config, options);
  await runtimeCapabilities(config, options);
  assert.equal(loginChecks, 1);
  await runtimeCapabilities(config, { ...options, forceCodexLoginCheck: true });
  assert.equal(loginChecks, 2);
});

test('Codex login status accepts the installed CLI stderr response after streams close', async () => {
  const status = await codexLoginStatus({
    spawnImpl: () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      queueMicrotask(() => {
        child.emit('exit', 0);
        child.stderr.write('Logged in using ChatGPT\n');
        child.stdout.end();
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  assert.equal(status.authenticated, true);
});

test('connect refuses to overwrite an existing pairing and its active assignment', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-connect-existing-')), 'state.json');
  const config = newConfig({
    server: 'http://127.0.0.1:8090', token: 'device-token', device: { id: 'device-1' },
    provider: 'codex', name: 'existing', workingDirectory: process.cwd(),
  });
  config.active = { jobId: 'job-1', runId: 'run-1', phase: 'needs_input' };
  await writeConfig(config, path);
  await assert.rejects(
    connect({ server: 'http://127.0.0.1:8090', code: 'new-pairing', provider: 'codex', name: 'replacement' }, path),
    /already paired.*disconnect/i,
  );
  assert.deepEqual((await readConfig(path)).active, config.active);
});

test('configuration is stored with owner-only permissions', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'h2h-config-'));
  const path = join(folder, 'local-agent.json');
  const config = newConfig({
    server: 'http://127.0.0.1:8090', token: 'device-token', device: { id: 'device-1' },
    provider: 'codex', name: 'test', workingDirectory: process.cwd(),
  });
  await writeConfig(config, path);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await readConfig(path)).token, 'device-token');
  await chmod(path, 0o644);
  await assert.rejects(readConfig(path), /insecure connector credential/);
});

test('a connector lock prevents a second local runner from sharing credentials', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-lock-')), 'local-agent.json');
  const first = await acquireConfigLock(path);
  await assert.rejects(acquireConfigLock(path), /Another h2h-local process owns this connector/);
  await first.release();
  const second = await acquireConfigLock(path);
  await second.release();
});

test('browser capability requires browser tools and accepts a large MCP tools/list frame', async () => {
  const profile = join(tmpdir(), 'h2h-browser-probe-profile');
  const server = `
    let input = '';
    process.stdin.on('data', (chunk) => {
      input += chunk.toString();
      const lines = input.split('\\n'); input = lines.pop();
      for (const line of lines) {
        const message = JSON.parse(line);
        if (message.id === 1) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'browser', version: '1' } } }) + '\\n');
        if (message.id === 2) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'browser_navigate', description: 'x'.repeat(12000), inputSchema: { type: 'object' } }] } }) + '\\n');
      }
    });
  `;
  const result = await probeBrowserMcp({
    command: process.execPath,
    args: ['-e', server, profile],
    profileDir: profile,
  });
  assert.equal(result.healthy, true);
});

test('Claude stream-json structured output takes precedence over display text and uses compatible noninteractive flags', () => {
  const structured = completedOutput();
  const raw = structuredOutputFromClaudeEvent({
    type: 'result', subtype: 'success', result: 'Human-readable completion', structured_output: structured,
  });
  assert.deepEqual(JSON.parse(raw), structured);
  assert.equal(structuredOutputFromClaudeEvent({ type: 'result', result: '{"status":"completed"}' }), '{"status":"completed"}');

  const { args } = buildClaudeArgs({
    prompt: 'Resolve this delegation.', identity: null, model: 'claude-test',
    browserMcp: { command: 'browser-mcp', args: ['--profile', '/tmp/h2h-profile'] },
  });
  assert(args.includes('--bare'));
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.equal(args[args.indexOf('--permission-prompts') + 1], 'none');
  assert.equal(args.includes('--permission-mode') && args.includes('bypassPermissions'), false);
  assert.equal(args.includes('--allow-dangerously-skip-permissions'), false);
  assert.equal(args[args.indexOf('--allowedTools') + 1], 'mcp__h2h_browser');
});

test('runner API uses the dedicated device token and accepts the data envelope', async () => {
  const fixture = await testServer();
  try {
    const api = new LocalAgentApi({ server: fixture.url, token: 'device-token' });
    const claim = await api.claim({ claim_id: 'claim-1' });
    assert.equal(claim.id, 'job-1');
    await api.progress('job-1', { run_id: 'run-1', event_id: 'event-1', message: 'Working.' });
    assert.equal(fixture.requests[0].headers.authorization, 'Bearer device-token');
    assert.deepEqual(fixture.requests[0].body, { claim_id: 'claim-1' });
    assert.equal(fixture.requests[1].path, '/api/local-agents/jobs/job-1/progress');
  } finally {
    await fixture.close();
  }
});

test('only an active MCP session sets readiness and a graceful bridge stop clears it', async () => {
  const fixture = await testServer();
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-worker-ready-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    await runner.status({ probeBrowser: false });
    assert.equal(fixture.requests.length, 0);
    await runner.claim();
    await runner.mcpStopped();
    const heartbeats = fixture.requests.filter((request) => request.path === '/api/local-agents/heartbeat');
    assert.equal(heartbeats.length, 2);
    assert.equal(heartbeats[0].body.worker_mode, 'mcp');
    assert.equal(heartbeats[1].body.worker_mode, null);
  } finally {
    await fixture.close();
  }
});

test('plural heartbeat IDs reconcile a terminally cancelled job without retaining capacity', async () => {
  const fixture = await testServer({ heartbeatResponse: { device: { id: 'device-1' }, active_jobs: [] } });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-terminal-heartbeat-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'investigate', instructions: 'Check status.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'mcp_started', providerIdentity: null,
    };
    const runner = new LocalRunner(config, { configPath: path });
    const state = await runner.input('job-1');
    assert.deepEqual(state, { cancelled: true, terminal: true, inputMessages: [] });
    assert.equal(config.active, null);
    const heartbeat = fixture.requests.find((request) => request.path === '/api/local-agents/heartbeat');
    assert.deepEqual(heartbeat.body.active_job_ids, ['job-1']);
  } finally {
    await fixture.close();
  }
});

test('an omitted heartbeat job retains a lost result receipt for idempotent retry', async () => {
  const fixture = await testServer({
    heartbeatResponse: (requests) => (requests.filter((request) => request.path === '/api/local-agents/heartbeat').length === 1
      ? { device: { id: 'device-1' }, active_jobs: [{ id: 'job-1', cancel_requested: false, input_messages: [] }] }
      : { device: { id: 'device-1' }, active_jobs: [] }),
    resultStatus: (requests) => (requests.filter((request) => request.path.endsWith('/result')).length === 1 ? 422 : 200),
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-lost-receipt-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Make the change.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: null,
    };
    const runner = new LocalRunner(config, { configPath: path });
    await assert.rejects(runner.result('completed', completedOutput()), /Result validation/);
    const firstEvent = config.active.pendingResult.eventId;

    await runner.input('job-1');
    assert.equal(config.active.phase, 'result_receipt_recovery');
    await runner.result('completed', completedOutput());

    const results = fixture.requests.filter((request) => request.path.endsWith('/result'));
    assert.equal(results[1].body.event_id, firstEvent);
    assert.equal(config.active, null);
  } finally {
    await fixture.close();
  }
});

test('a denied recovered result receipt is retained for audit then removes only that local job', async () => {
  const fixture = await testServer({
    heartbeatResponse: (requests) => (requests.filter((request) => request.path === '/api/local-agents/heartbeat').length === 1
      ? { device: { id: 'device-1' }, active_jobs: [{ id: 'job-1', cancel_requested: false, input_messages: [] }] }
      : { device: { id: 'device-1' }, active_jobs: [] }),
    resultStatus: (requests) => (requests.filter((request) => request.path.endsWith('/result')).length === 1 ? 422 : 403),
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-denied-receipt-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Make the change.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: null,
    };
    const runner = new LocalRunner(config, { configPath: path });
    await assert.rejects(runner.result('completed', completedOutput()), /Result validation/);
    const firstEvent = config.active.pendingResult.eventId;

    await runner.input('job-1');
    assert.equal(config.active.phase, 'result_receipt_recovery');
    const outcome = await runner.result('completed', completedOutput());
    assert.equal(outcome.status, 'access_denied_terminal');
    assert.equal(config.active, null);
    const persisted = await readConfig(path);
    assert.equal(persisted.active, null);
    assert.equal(persisted.terminalResultReceipts.length, 1);
    const expectedResult = validateAgentOutput(completedOutput()).result;
    assert.deepEqual(persisted.terminalResultReceipts[0], {
      jobId: 'job-1', runId: 'run-1', eventId: firstEvent, status: 'completed',
      result: expectedResult, sessionId: null, httpStatus: 403, reason: 'workspace_access_lost',
      deniedAt: persisted.terminalResultReceipts[0].deniedAt,
    });
    assert.match(persisted.terminalResultReceipts[0].deniedAt, /^\d{4}-\d{2}-\d{2}T/);
    await assert.rejects(runner.result('completed', completedOutput()), /no active job/i);
    assert.equal(fixture.requests.filter((request) => request.path.endsWith('/result')).length, 2);
  } finally {
    await fixture.close();
  }
});

test('MCP returns unavailable mapped folders as diagnostics without blocking an assignment', async () => {
  const missing = join(tmpdir(), `h2h-no-folder-${Date.now()}`);
  const fixture = await testServer({ claimResponse: () => ({
    id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Edit the repository.', context: {}, workspace_folders: [missing],
  }) });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-folder-map-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    const runner = new LocalRunner(config, { configPath: path });
    const assignment = await runner.claim();
    assert.equal(assignment.id, 'job-1');
    assert.deepEqual(assignment.workspace_folders, []);
    assert.match(assignment.agent_guidance.local_folder_rule, /unavailable on this computer/);
    assert.match(assignment.agent_guidance.local_folder_rule, /Suggested folders are starting points/);
    assert.equal(fixture.requests.some((request) => request.path.endsWith('/result')), false);
    assert.equal(config.active.phase, 'mcp_started');
  } finally {
    await fixture.close();
  }
});

test('direct workers use mapped folders only as starting points and fall back when none are usable', async () => {
  const startingFolder = await mkdtemp(join(tmpdir(), 'h2h-mapped-start-'));
  const resolvedStartingFolder = await realpath(startingFolder);
  const configuredDirectory = await mkdtemp(join(tmpdir(), 'h2h-configured-start-'));
  const missing = join(tmpdir(), `h2h-no-folder-${Date.now()}`);
  const cases = [
    { name: 'a mapped folder', workspaceFolders: [startingFolder], expectedDirectory: resolvedStartingFolder, diagnostic: null },
    { name: 'an empty mapping', workspaceFolders: [], expectedDirectory: configuredDirectory, diagnostic: null },
    { name: 'an unavailable mapping', workspaceFolders: [missing], expectedDirectory: configuredDirectory, diagnostic: /unavailable on this computer/ },
  ];

  for (const scenario of cases) {
    const fixture = await testServer({ claimResponse: () => ({
      id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Edit the repository.', context: {}, workspace_folders: scenario.workspaceFolders,
    }) });
    const path = join(await mkdtemp(join(tmpdir(), 'h2h-folder-direct-')), 'local-agent.json');
    try {
      const config = newConfig({
        server: fixture.url, token: 'device-token', device: { id: 'device-1' },
        provider: 'codex', name: 'test', workingDirectory: configuredDirectory,
      });
      let providerOptions;
      const runner = new LocalRunner(config, {
        configPath: path,
        runtimeCapabilitiesFn: availableDirectRuntime,
        providerRunner: async (_provider, options) => {
          providerOptions = options;
          return { cancelled: false, rawText: JSON.stringify(completedOutput()) };
        },
      });

      await runner.run({ once: true });

      assert.equal(providerOptions.workingDirectory, scenario.expectedDirectory, scenario.name);
      assert.match(providerOptions.prompt, /Suggested folders are starting points/);
      assert.match(providerOptions.prompt, /another local directory/);
      if (scenario.diagnostic) assert.match(providerOptions.prompt, scenario.diagnostic);
      assert.equal(fixture.requests.some((request) => request.path.endsWith('/result')), true);
      assert.equal(config.active, null);
    } finally {
      await fixture.close();
    }
  }
});

test('MCP uploads a verified local screenshot only for its named job', async () => {
  const fixture = await testServer();
  const folder = await mkdtemp(join(tmpdir(), 'h2h-upload-'));
  const path = join(folder, 'local-agent.json');
  const screenshot = join(folder, 'evidence.png');
  await writeFile(screenshot, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'investigate', instructions: 'Capture evidence.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'mcp_started', providerIdentity: null,
    };
    const runner = new LocalRunner(config, { configPath: path });
    const uploaded = await runner.upload(screenshot, 'job-1');
    assert.equal(uploaded.attachment.id, '5c01791a-a710-4d70-aad6-82c575da7c2e');
    const request = fixture.requests.find((entry) => entry.path.endsWith('/attachments'));
    assert.equal(request.headers.authorization, 'Bearer device-token');
    assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.match(request.body, /name="run_id"/);
    assert.match(request.body, /run-1/);
    assert.match(request.body, /filename="evidence.png"/);
    const oversized = join(folder, 'too-large.png');
    await writeFile(oversized, Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(4 * 1024 * 1024),
    ]));
    await assert.rejects(runner.upload(oversized, 'job-1'), /4 MiB/);
  } finally {
    await fixture.close();
  }
});

test('direct worker claims and completes two independent browser-only jobs concurrently', async () => {
  const stop = new AbortController();
  const claims = [
    { id: 'job-a', run_id: 'run-a', mode: 'investigate', instructions: 'Inspect account A.', context: {}, workspace_folders: [] },
    { id: 'job-b', run_id: 'run-b', mode: 'investigate', instructions: 'Inspect account B.', context: {}, workspace_folders: [] },
    null,
  ];
  const fixture = await testServer({
    claimResponse: () => claims.shift(),
    resultResponse: (requests) => {
      if (requests.filter((request) => request.path.endsWith('/result')).length === 2) stop.abort();
      return { accepted: true };
    },
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-concurrent-direct-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    let activeProviders = 0;
    let peakProviders = 0;
    let startedProviders = 0;
    let release;
    const bothStarted = new Promise((resolve) => { release = resolve; });
    const runner = new LocalRunner(config, {
      configPath: path,
      runtimeCapabilitiesFn: availableDirectRuntime,
      providerRunner: async () => {
        activeProviders += 1;
        peakProviders = Math.max(peakProviders, activeProviders);
        startedProviders += 1;
        if (startedProviders === 2) release();
        await bothStarted;
        activeProviders -= 1;
        return {
          cancelled: false,
          rawText: JSON.stringify({
            status: 'completed', summary: 'Observed current state.', actions: [],
            replies: [{ id: `reply-${startedProviders}`, title: 'Observed state', body: 'Here is the observed state.' }],
            verified: true, question: null,
          }),
        };
      },
    });

    await runner.run({ signal: stop.signal });

    assert.equal(peakProviders, 2);
    const resultRequests = fixture.requests.filter((request) => request.path.endsWith('/result'));
    assert.deepEqual(resultRequests.map((request) => request.path.split('/')[4]).sort(), ['job-a', 'job-b']);
    assert.equal(config.active, null);
    assert.deepEqual(config.activeJobs, {});
  } finally {
    await fixture.close();
  }
});

test('concurrent monitors stop every omitted membership-loss job', async () => {
  const stop = new AbortController();
  const claims = [
    { id: 'job-a', run_id: 'run-a', mode: 'investigate', instructions: 'Inspect account A.', context: {}, workspace_folders: [] },
    { id: 'job-b', run_id: 'run-b', mode: 'investigate', instructions: 'Inspect account B.', context: {}, workspace_folders: [] },
    null,
  ];
  const fixture = await testServer({
    claimResponse: () => claims.shift(),
    heartbeatResponse: { device: { id: 'device-1' }, active_jobs: [] },
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-concurrent-membership-loss-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    let started = 0;
    let terminalAborts = 0;
    const runner = new LocalRunner(config, {
      configPath: path,
      runtimeCapabilitiesFn: availableDirectRuntime,
      monitorIntervalMs: 10,
      providerRunner: async (provider, { signal }) => new Promise((resolve) => {
        started += 1;
        signal.addEventListener('abort', () => {
          if (signal.reason?.code === 'JOB_TERMINAL') terminalAborts += 1;
          if (terminalAborts === 2) stop.abort();
          resolve({ cancelled: true, rawText: '' });
        }, { once: true });
      }),
    });
    const timeout = setTimeout(() => stop.abort(new Error('Timed out waiting for both terminal monitor aborts.')), 500);
    await runner.run({ signal: stop.signal });
    clearTimeout(timeout);

    assert.equal(started, 2);
    assert.equal(terminalAborts, 2);
    assert.deepEqual(config.activeJobs, {});
    assert.equal(fixture.requests.some((request) => request.path.endsWith('/result')), false);
  } finally {
    await fixture.close();
  }
});

test('MCP result submission persists an idempotency event before clearing active state', async () => {
  const fixture = await testServer();
  const folder = await mkdtemp(join(tmpdir(), 'h2h-runner-'));
  const path = join(folder, 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: { provider: 'codex', providerSessionId: 'thread-1' },
      pendingInput: [], pendingResult: null, progressSequence: 0,
    };
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    await runner.result('completed', completedOutput(), 'thread-1');
    const request = fixture.requests.find((item) => item.path.endsWith('/result'));
    assert.equal(request.body.status, 'completed');
    assert.equal(request.body.run_id, 'run-1');
    assert.match(request.body.event_id, /^run-1:result:/);
    assert.equal(request.body.session_id, 'thread-1');
    assert.equal((await readConfig(path)).active, null);
  } finally {
    await fixture.close();
  }
});

test('server result status wins and keeps the same session for needs_input', async () => {
  const fixture = await testServer({
    resultResponse: {
      id: 'job-1', status: 'needs_input',
      result: { question: 'Which legal entity should receive the invoice?' },
      current_context: { conversation: { id: 'c-1', latest_note: 'Awaiting entity.' } },
    },
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-status-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve_reply', instructions: 'Correct the invoice.', context: { conversation: { id: 'c-1' } } },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: { provider: 'codex', providerThreadId: 'thread-1', providerSessionId: 'session-1' },
      pendingInput: [], pendingResult: null, progressSequence: 0,
    };
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    const submitted = await runner.result('completed', completedOutput(), 'session-1');
    assert.equal(submitted.status, 'needs_input');
    const restored = await readConfig(path);
    assert.equal(restored.active.phase, 'needs_input');
    assert.equal(restored.active.providerIdentity.providerThreadId, 'thread-1');
    assert.equal(restored.active.operatorQuestion, 'Which legal entity should receive the invoice?');
    assert.equal(restored.active.currentContext.conversation.latest_note, 'Awaiting entity.');
  } finally {
    await fixture.close();
  }
});

test('a rejected valid result remains pending with its original event for retry', async () => {
  const fixture = await testServer({ resultStatus: 422 });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-pending-result-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: { provider: 'codex', providerSessionId: 'session-1' },
    };
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    await assert.rejects(runner.result('needs_input', needsInputResult(), 'session-1'), /Result validation/);
    const pending = (await readConfig(path)).active.pendingResult;
    assert.equal(pending.status, 'needs_input');
    assert.match(pending.eventId, /^run-1:result:/);
    assert.equal(fixture.requests.filter((request) => request.path.endsWith('/result')).length, 1);
  } finally {
    await fixture.close();
  }
});

test('fresh context uses the scoped runner endpoint without changing the claimed snapshot', async () => {
  const fixture = await testServer({ contextResponse: { conversation: { id: 'c-1', latest_message: 'The operator confirmed entity B.' } } });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-context-')), 'local-agent.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: { conversation: { id: 'c-1', latest_message: 'Claim-time message.' } } },
      jobId: 'job-1', runId: 'run-1', phase: 'needs_input', providerIdentity: { provider: 'codex', providerSessionId: 'session-1' },
    };
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    assert.equal((await runner.context({ fresh: true })).context.conversation.latest_message, 'The operator confirmed entity B.');
    const restored = await readConfig(path);
    assert.equal(restored.active.job.context.conversation.latest_message, 'Claim-time message.');
    assert.equal(restored.active.currentContext.conversation.latest_message, 'The operator confirmed entity B.');
  } finally {
    await fixture.close();
  }
});

test('a fresh-context failure keeps operator input pending and never invokes the provider', async () => {
  const fixture = await testServer({ contextStatus: 503 });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-stale-context-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: { conversation: { id: 'c-1' } } },
      jobId: 'job-1', runId: 'run-1', phase: 'needs_input', providerIdentity: { provider: 'codex', providerSessionId: 'session-1' },
      pendingInput: [{ id: 'input-1', message: 'Use entity B.' }], pendingResult: null,
    };
    await writeConfig(config, path);
    let providerCalls = 0;
    const runner = new LocalRunner(config, {
      configPath: path,
      runtimeCapabilitiesFn: availableDirectRuntime,
      providerRunner: async () => { providerCalls += 1; throw new Error('Provider must not run on stale context.'); },
    });
    await assert.rejects(runner.run({ once: true }), /Fresh evidence is temporarily unavailable/);
    assert.equal(providerCalls, 0);
    const restored = await readConfig(path);
    assert.equal(restored.active.phase, 'needs_input');
    assert.deepEqual(restored.active.pendingInput, [{ id: 'input-1', message: 'Use entity B.' }]);
    assert.deepEqual(restored.seenInputIds, []);
  } finally {
    await fixture.close();
  }
});

test('a delivery-in-progress duplicate result stays pending and retries with the same event ID', async () => {
  let responseCount = 0;
  const fixture = await testServer({
    resultResponse: () => {
      responseCount += 1;
      return responseCount === 1
        ? { id: 'job-1', status: 'running', delivery_state: 'delivering' }
        : { id: 'job-1', status: 'completed' };
    },
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-delivery-pending-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve_reply', instructions: 'Do the work.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: { provider: 'codex', providerSessionId: 'session-1' },
      pendingInput: [], pendingResult: null,
    };
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    const first = await runner.result('completed', completedOutput(), 'session-1');
    assert.equal(first.status, 'delivery_pending');
    const afterFirst = await readConfig(path);
    assert.equal(afterFirst.active.phase, 'delivery_pending');
    const eventId = afterFirst.active.pendingResult.eventId;
    const second = await runner.result('completed', completedOutput(), 'session-1');
    assert.equal(second.status, 'completed');
    const resultRequests = fixture.requests.filter((request) => request.path.endsWith('/result'));
    assert.equal(resultRequests.length, 2);
    assert.equal(resultRequests[0].body.event_id, eventId);
    assert.equal(resultRequests[1].body.event_id, eventId);
    assert.equal((await readConfig(path)).active, null);
  } finally {
    await fixture.close();
  }
});

test('invalid and unverified structured output cannot be completed', () => {
  assert.throws(() => validateAgentOutput({ ...completedOutput(), verified: false }), /Completed work must be verified/);
  assert.throws(() => validateAgentOutput({ ...completedOutput(), extra: 'not allowed' }), /unsupported field/);
  assert.throws(() => validateAgentOutput({ ...completedOutput(), question: 'An unresolved question.' }), /question to null/);
  assert.deepEqual(validateAgentOutput(completedOutput()).status, 'completed');
});

test('result proposals are transported without turning them into performed evidence', () => {
  const attachmentId = '5c01791a-a710-4d70-aad6-82c575da7c2e';
  const output = validateAgentOutput({
    ...completedOutput(),
    attachment_ids: [attachmentId],
    replies: [{ id: 'reply-confirm', title: 'Confirm outcome', body: 'Your address is updated.', attachment_ids: [attachmentId] }],
    follow_up_actions: [{ id: 'verify-invoice', title: 'Verify invoice', instructions: 'Check the next invoice address.', mode: 'investigate', attachment_ids: ['3b19a10d-6b5d-4e12-93cb-60d45011d975'] }],
  });
  assert.equal(output.result.actions[0].description, 'Updated the address.');
  assert.equal(output.result.replies[0].id, 'reply-confirm');
  assert.deepEqual(output.result.attachment_ids, [attachmentId]);
  assert.equal(output.result.follow_up_actions[0].mode, 'investigate');
  assert.throws(() => validateAgentOutput({
    ...completedOutput(),
    replies: [{ id: 'duplicate', title: 'One', body: 'A' }, { id: 'duplicate', title: 'Two', body: 'B' }],
  }), /unique stable id/);
  assert.throws(() => validateAgentOutput({
    ...completedOutput(), attachment_ids: ['not-an-upload-id'],
  }), /attachment UUIDs/);
});

test('an uncertain dispatched run refuses automatic replay before contacting a runtime', async () => {
  const fixture = await testServer();
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-replay-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = { jobId: 'job-unknown', runId: 'run-unknown', phase: 'dispatched' };
    const runner = new LocalRunner(config, { configPath: path, runtimeCapabilitiesFn: unavailableDirectRuntime });
    await assert.rejects(runner.run({ once: true }), /will not be replayed/);
  } finally {
    await fixture.close();
  }
});

test('direct runner refuses a persisted MCP assignment without invoking a provider', async () => {
  const fixture = await testServer();
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-mcp-direct-replay-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'mcp_started', mcpInstanceId: 'old-host', pendingInput: [],
    };
    await writeConfig(config, path);
    let providerCalls = 0;
    const runner = new LocalRunner(config, {
      configPath: path,
      runtimeCapabilitiesFn: unavailableDirectRuntime,
      providerRunner: async () => { providerCalls += 1; throw new Error('Provider must not restart an MCP assignment.'); },
    });
    await assert.rejects(runner.run({ once: true }), /will not be replayed/);
    assert.equal(providerCalls, 0);
  } finally {
    await fixture.close();
  }
});

test('a server cancellation clears an uncertain run without restarting its provider', async () => {
  const fixture = await testServer({
    heartbeatResponse: { device: { id: 'device-1' }, cancel_requested: true, input_messages: [] },
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-uncertain-cancel-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'dispatched', providerIdentity: { provider: 'codex', providerSessionId: 'session-1' },
    };
    await writeConfig(config, path);
    let providerCalls = 0;
    const runner = new LocalRunner(config, {
      configPath: path,
      runtimeCapabilitiesFn: unavailableDirectRuntime,
      providerRunner: async () => { providerCalls += 1; throw new Error('Provider must not restart.'); },
    });
    await runner.run({ once: true });
    assert.equal(providerCalls, 0);
    assert.equal((await readConfig(path)).active, null);
    const resultRequest = fixture.requests.find((request) => request.path.endsWith('/result'));
    assert.equal(resultRequest.body.status, 'cancelled');
  } finally {
    await fixture.close();
  }
});

test('an unavailable runtime still reconciles every pending receipt and cancellation', async () => {
  const fixture = await testServer({
    heartbeatResponse: {
      device: { id: 'device-1' },
      active_jobs: [
        { id: 'job-awaiting-runtime', cancel_requested: false, input_messages: [] },
        { id: 'job-pending-receipt', cancel_requested: false, input_messages: [] },
        { id: 'job-cancelled', cancel_requested: true, input_messages: [] },
      ],
    },
  });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-unavailable-reconcile-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.activeJobs = {
      'job-awaiting-runtime': {
        job: { id: 'job-awaiting-runtime', run_id: 'run-awaiting', mode: 'resolve', instructions: 'Wait for the runtime.', context: {} },
        jobId: 'job-awaiting-runtime', runId: 'run-awaiting', phase: 'claimed', pendingInput: [],
      },
      'job-pending-receipt': {
        job: { id: 'job-pending-receipt', run_id: 'run-pending', mode: 'resolve', instructions: 'Recover receipt.', context: {} },
        jobId: 'job-pending-receipt', runId: 'run-pending', phase: 'claimed', pendingInput: [],
        pendingResult: {
          eventId: 'run-pending:result:saved', status: 'completed', result: validateAgentOutput(completedOutput()).result, sessionId: null,
        },
      },
      'job-cancelled': {
        job: { id: 'job-cancelled', run_id: 'run-cancelled', mode: 'resolve', instructions: 'Stop.', context: {} },
        jobId: 'job-cancelled', runId: 'run-cancelled', phase: 'dispatched', pendingInput: [],
      },
    };
    await writeConfig(config, path);
    let providerCalls = 0;
    const runner = new LocalRunner(config, {
      configPath: path,
      runtimeCapabilitiesFn: unavailableDirectRuntime,
      providerRunner: async () => { providerCalls += 1; throw new Error('Unavailable runtime must never launch.'); },
    });

    await assert.rejects(runner.run({ once: true }), /direct runner is unavailable/);
    assert.equal(providerCalls, 0);
    const resultRequests = fixture.requests.filter((request) => request.path.endsWith('/result'));
    assert.deepEqual(resultRequests.map((request) => [request.path.split('/')[4], request.body.status]).sort(), [
      ['job-cancelled', 'cancelled'],
      ['job-pending-receipt', 'completed'],
    ]);
    const persisted = await readConfig(path);
    assert.deepEqual(Object.keys(persisted.activeJobs), ['job-awaiting-runtime']);
    assert.equal(persisted.active.pendingResult, undefined);
  } finally {
    await fixture.close();
  }
});

test('a new MCP host requires a fresh operator recovery input before repeating a claimed assignment', async () => {
  const fixture = await testServer();
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-mcp-recovery-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    await writeConfig(config, path);
    const firstHost = new LocalRunner(config, { configPath: path });
    const assignment = await firstHost.claim();
    assert.equal(assignment.agent_guidance.recovery, undefined);
    const secondConfig = await readConfig(path);
    const secondHost = new LocalRunner(secondConfig, { configPath: path });
    const staleAssignment = await secondHost.claim();
    assert.equal(staleAssignment.agent_guidance.recovery.required, true);
    await assert.rejects(secondHost.recover('missing-input'), /Recovery requires/);
    secondConfig.active.pendingInput = [{ id: 'operator-recovery-1', message: 'Please continue from the verified record; do not repeat the update.' }];
    await secondHost.save();
    const recovered = await secondHost.recover('operator-recovery-1');
    assert.equal(recovered.agent_guidance.recovery.recovered, true);
    assert.match(recovered.agent_guidance.recovery.trusted_operator_recovery_input, /do not repeat/);
  } finally {
    await fixture.close();
  }
});

test('revoked device authorization stops an active run without sending a pretend cancellation result', async () => {
  const fixture = await testServer({ heartbeatStatus: 401 });
  const path = join(await mkdtemp(join(tmpdir(), 'h2h-revoked-')), 'state.json');
  try {
    const config = newConfig({
      server: fixture.url, token: 'device-token', device: { id: 'device-1' },
      provider: 'codex', name: 'test', workingDirectory: process.cwd(),
    });
    config.active = {
      job: { id: 'job-1', run_id: 'run-1', mode: 'resolve', instructions: 'Do the work.', context: {} },
      jobId: 'job-1', runId: 'run-1', phase: 'claimed', providerIdentity: null,
    };
    await writeConfig(config, path);
    const runner = new LocalRunner(config, { configPath: path });
    await assert.rejects(runner.run({ once: true }), /Device revoked/);
    assert.equal((await readConfig(path)).active.phase, 'revoked_unknown');
    assert.equal(fixture.requests.some((request) => request.path.endsWith('/result')), false);
  } finally {
    await fixture.close();
  }
});

test('MCP stdio exposes assignment tools without fabricating desktop capabilities', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let wire = '';
  output.on('data', (chunk) => { wire += chunk.toString('utf8'); });
  const runner = {
    waitForAssignment: async () => ({ id: 'job-1' }), claim: async () => ({ id: 'job-1' }),
    context: async () => ({ conversation: { id: 'c-1' } }), progress: async () => ({ accepted: true }),
    result: async () => ({ accepted: true }), input: async () => ({ cancelRequested: false, inputMessages: [] }),
  };
  const serving = serveMcp(runner, { input, output, error: new PassThrough() });
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'h2h_wait_for_assignment', arguments: {} } })}\n`);
  input.end();
  await serving;
  const messages = wire.trim().split('\n').map(JSON.parse);
  assert.equal(messages[0].result.serverInfo.name, 'happytohelp-local-agent');
  assert.equal(messages[0].result.serverInfo.version, '0.2.1');
  assert(messages[1].result.tools.some((tool) => tool.name === 'h2h_context'));
  assert(messages[1].result.tools.some((tool) => tool.name === 'h2h_recover'));
  assert.deepEqual(JSON.parse(messages[2].result.content[0].text), { id: 'job-1' });
});
