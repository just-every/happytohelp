import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { providerFixture, strictOutput } from '../../tests/provider-helpers/fixture.mjs';

test('h2h-local connect and run use customer ChatGPT login without an API key and preserve the chosen model', async () => {
  const fixture = await providerFixture({ chatgptLogin: true, output: strictOutput, notification: false });
  const requests = [];
  let claimed = false;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const data = body ? JSON.parse(body) : null;
    requests.push({ path: request.url, data });
    const send = value => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ data: value })); };
    if (request.url === '/api/local-agents/pair') return send({ token: 'test-only-device-token', device: { id: 'device-login' } });
    if (request.url === '/api/local-agents/heartbeat') return send({ device: { id: 'device-login' }, cancel_requested: false, input_messages: [] });
    if (request.url === '/api/local-agents/claim') {
      const job = claimed ? null : { id: 'job-login', run_id: 'run-login', mode: 'resolve', instructions: 'Check fixture state', context: { conversation: { id: 'c-login' } } };
      claimed = true;
      return send(job);
    }
    if (request.url.startsWith('/api/local-agents/jobs/job-login/context?')) return send({ conversation: { id: 'c-login' } });
    if (['/api/local-agents/jobs/job-login/result', '/api/local-agents/jobs/job-login/progress'].includes(request.url)) return send({ accepted: true });
    response.writeHead(404); response.end();
  });
  try {
    const home = join(fixture.directory, 'chatgpt-home');
    await mkdir(home, { mode: 0o700 });
    await writeFile(join(home, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'test-only-chatgpt-token' } }), { mode: 0o600 });
    const env = { ...process.env, CODEX_HOME: home, H2H_LOCAL_CONFIG: join(fixture.directory, 'connector.json') };
    delete env.OPENAI_API_KEY;
    delete env.OPENAI_BASE_URL;
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const cli = new URL('../bin/h2h-local.mjs', import.meta.url).pathname;
    const exec = args => promisify(execFile)(process.execPath, [cli, ...args], { env, timeout: 20_000 });
    await exec(['connect', '--server', url, '--code', 'test-pairing', '--provider', 'codex', '--name', 'ChatGPT customer', '--workdir', fixture.directory, '--model', 'gpt-6.1-sol']);
    const config = JSON.parse(await readFile(env.H2H_LOCAL_CONFIG, 'utf8'));
    assert.equal(config.codexAuth.authenticated, true);
    assert.equal(config.model, 'gpt-6.1-sol');
    assert.ok(requests.find(request => request.path.endsWith('/pair')).data.capabilities.includes('direct_runner'));
    await exec(['run', '--once']);
    await exec(['run', '--once']);
    for (const suffix of ['.thread-request', '.request']) {
      const request = JSON.parse(await readFile(fixture.path + suffix, 'utf8'));
      assert.equal(request.params.model, 'gpt-6.1-sol');
      assert.equal(request.params.modelProvider, undefined);
    }
    assert.deepEqual((await readFile(fixture.path + '.auth-check', 'utf8')).trim().split('\n'), ['login status', 'login status', 'app-server', 'login status']);
    assert.equal((await readFile(fixture.path + '.calls', 'utf8')).trim(), 'turn/start');
    const results = requests.filter(request => request.path.endsWith('/result'));
    assert.equal(results.length, 1);
    assert.equal(results[0].data.status, 'completed');
    assert.equal(results[0].data.result.verified, true);
    assert.doesNotMatch(JSON.stringify(requests), /test-only-chatgpt-token/);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await fixture.close();
  }
});
