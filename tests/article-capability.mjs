import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';
import {test} from 'node:test';
import {articleCapability} from './helpers/hero/article-capability.mjs';

const article = {id: 'guide-123', slug: 'support-guide', title: 'Support guide', content: 'Existing guide', status: 'draft'};
const projectId = 'project-123';
const cookie = 'h2h_session=test-owner';
const body = JSON.stringify({articleId: article.id});

async function fixture(t, createCapability, respond = (_req, res) => {
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({article: {...article, status: 'published'}}));
}) {
  const writes = [];
  const upstream = createServer(async (req, res) => {
    let text = '';
    for await (const chunk of req) text += chunk;
    writes.push({method: req.method, path: req.url, cookie: req.headers.cookie, origin: req.headers.origin, body: JSON.parse(text)});
    respond(req, res);
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  });
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const capability = await createCapability({origin, cookie, projectId, article});
  t.after(() => capability.close());
  const call = (text = body, path = '/publish', method = 'POST', token = capability.token) => fetch(capability.base + path, {
    method, headers: {Authorization: `Bearer ${token}`}, ...(method === 'POST' ? {body: text} : {}),
  });
  const assertOneWrite = () => assert.deepEqual(writes, [{
    method: 'POST', path: `/api/knowledge/${projectId}/articles`, cookie, origin,
    body: {...article, status: 'published'},
  }]);
  return {capability, call, writes, assertOneWrite, origin};
}

// Expect/continue acknowledges each request's headers while its JSON body is
// incomplete, so both requests have entered the real HTTP handler before either
// body finishes. No timing sleeps or replacement capability handler are needed.
function streamingPublish(t, capability) {
  const req = request(capability.base + '/publish', {
    method: 'POST', headers: {Authorization: `Bearer ${capability.token}`, Expect: '100-continue'},
  });
  const ready = new Promise((resolve, reject) => {
    req.once('continue', resolve);
    req.once('error', reject);
  });
  const result = new Promise((resolve, reject) => {
    req.once('error', reject);
    req.once('response', async res => {
      try {
        let text = '';
        for await (const chunk of res) text += chunk;
        resolve({status: res.statusCode, body: JSON.parse(text)});
      } catch (error) { reject(error); }
    });
  });
  const settled = Promise.allSettled([ready, result]);
  t.after(async () => { req.destroy(); await settled; });
  req.write(body.slice(0, -1));
  return {ready, result, finish: () => req.end(body.slice(-1))};
}

// Also reusable by the private live harness's local, no-provider proof.
export function capabilityContract(createCapability, label) {
  test(`${label}: overlapping streamed publication bodies admit exactly one native POST`, {timeout: 5000}, async t => {
    const entered = Promise.withResolvers();
    let firstResponse;
    const f = await fixture(t, createCapability, (_req, res) => {
      if (!firstResponse) { firstResponse = res; entered.resolve(); }
      else { res.writeHead(201); res.end('{}'); }
    });
    const first = streamingPublish(t, f.capability);
    const second = streamingPublish(t, f.capability);
    await Promise.all([first.ready, second.ready]);
    assert.equal(f.writes.length, 0, 'incomplete bodies cannot forward a native write');
    first.finish();
    await entered.promise;
    second.finish();
    const refused = await second.result;
    assert.equal(refused.status, 409, 'overlapping request is denied while the first native POST is still pending');
    assert.match(refused.body.error, /never repeat/);
    f.assertOneWrite();
    firstResponse.writeHead(201);
    firstResponse.end('{}');
    assert.equal((await first.result).status, 201);
    assert.equal((await f.call()).status, 409);
    f.assertOneWrite();
    assert.equal(f.capability.receipts.length, 1);
    assert.equal(f.capability.receipts[0].status, 201);
  });

  test(`${label}: simultaneous streamed body completion admits exactly one native POST`, {timeout: 5000}, async t => {
    const f = await fixture(t, createCapability);
    const requests = [streamingPublish(t, f.capability), streamingPublish(t, f.capability)];
    await Promise.all(requests.map(req => req.ready));
    requests.forEach(req => req.finish());
    const responses = await Promise.all(requests.map(req => req.result));
    assert.deepEqual(responses.map(res => res.status).sort(), [201, 409]);
    f.assertOneWrite();
  });

  test(`${label}: invalid bodies reject without consuming the native attempt`, {timeout: 5000}, async t => {
    const f = await fixture(t, createCapability);
    for (const [text, status] of [
      [JSON.stringify({articleId: 'another-article'}), 403],
      [JSON.stringify({articleId: article.id, status: 'published'}), 403],
      ['{}', 403], ['[]', 403], ['null', 502], ['{', 502], [' '.repeat(2049), 502],
    ]) {
      assert.equal((await f.call(text)).status, status);
      assert.equal(f.writes.length, 0);
    }
    assert.equal((await f.call()).status, 201);
    assert.equal((await f.call()).status, 409);
    f.assertOneWrite();
  });

  test(`${label}: authentication, route scope and article reads preserve publication authority`, {timeout: 5000}, async t => {
    const f = await fixture(t, createCapability);
    assert.equal((await f.call(body, '/publish', 'POST', 'wrong-token')).status, 403);
    assert.equal((await f.call(body, '/article', 'GET', 'wrong-token')).status, 403);
    assert.equal((await f.call(body, '/other')).status, 404);
    assert.equal((await f.call(body, '/publish', 'GET')).status, 404);
    const expected = {article, publicUrl: `${f.origin}/help/${projectId}/${article.slug}`, publicApiUrl: `${f.origin}/api/knowledge/public/${projectId}/articles/${article.slug}`};
    assert.deepEqual(await (await f.call(body, '/article', 'GET')).json(), expected);
    assert.equal(f.writes.length, 0);
    assert.equal((await f.call()).status, 201);
    assert.deepEqual(await (await f.call(body, '/article', 'GET')).json(), expected);
    f.assertOneWrite();
  });

  for (const outcome of ['native refusal', 'lost native response', 'unreadable native response']) {
    test(`${label}: ${outcome} never permits another attempt`, {timeout: 5000}, async t => {
      const f = await fixture(t, createCapability, (_req, res) => {
        if (outcome === 'lost native response') { res.destroy(); return; }
        res.writeHead(outcome === 'native refusal' ? 403 : 201);
        res.end(outcome === 'native refusal' ? '{"error":"Forbidden"}' : 'invalid JSON');
      });
      const response = await f.call();
      assert.equal(response.status, outcome === 'native refusal' ? 403 : 502);
      if (outcome !== 'native refusal') {
        assert.match((await response.json()).error, /Outcome unknown.*no repeat/);
        assert.deepEqual(f.capability.receipts, [{outcome: 'unknown; never replay'}]);
      }
      assert.equal((await f.call()).status, 409);
      f.assertOneWrite();
    });
  }
}

capabilityContract(articleCapability, 'native browser capability');
