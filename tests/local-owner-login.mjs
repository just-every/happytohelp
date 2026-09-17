import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {build} from 'esbuild';

const packages = await readdir('node_modules/.pnpm');
const {Miniflare, convertV4MiniflareOptions} = await import('../node_modules/.pnpm/' + packages.find(x => x.startsWith('miniflare@')) + '/node_modules/miniflare/dist/src/index.js');
const bundled = await build({stdin: {contents: `
  import {localOwnerLogin} from './src/development/local-owner-login';
  import {requireActor} from './src/platform/auth';
  localOwnerLogin.get('/test/session', async c => c.json(await requireActor(c)));
  export default {fetch: localOwnerLogin.fetch};
`, resolveDir: process.cwd()}, bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent'});
const runtime = new Miniflare(convertV4MiniflareOptions({modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-09-08', d1Databases: ['DB']}));
try {
  const db = await runtime.getD1Database('DB');
  for (const file of ['0001_identity.sql', '0003_identity_credentials.sql', '0005_widget_identity.sql', '0070_management.sql']) {
    for (const sql of (await readFile('migrations/' + file, 'utf8')).split(';').filter(s => s.trim())) await db.prepare(sql).run();
  }
  const origin = 'http://localhost:5174';
  const login = (headers = {}, url = origin) => runtime.dispatchFetch(url + '/api/identity/local-owner-session', {method: 'POST', headers: {Origin: origin, 'Sec-Fetch-Site': 'same-origin', ...headers}});
  assert.equal((await login()).status, 409, 'No owner means no automatic setup');
  await db.batch([
    db.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Review','widget','http://localhost',1)"),
    db.prepare("INSERT INTO users VALUES('owner','owner@example.test','Owner',1)"),
    db.prepare("INSERT INTO memberships VALUES('p','owner','owner')"),
    db.prepare("INSERT INTO credentials VALUES('owner','retained-existing-hash',1)"),
  ]);
  for (const headers of [{Origin: 'https://outside.test'}, {Origin: 'null'}, {Origin: ''}, {'Sec-Fetch-Site': 'cross-site'}, {'Sec-Fetch-Site': 'same-site'}, {'Sec-Fetch-Site': ''}]) {
    assert.equal((await login(headers)).status, 403);
  }
  assert.equal((await login({Origin: 'https://localhost:5174'}, 'https://localhost:5174')).status, 403);
  assert.equal((await login({Origin: 'http://outside.test'}, 'http://outside.test')).status, 403);
  const accepted = await login();
  assert.equal(accepted.status, 200);
  const cookie = accepted.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const session = () => runtime.dispatchFetch(origin + '/test/session', {headers: {Cookie: cookie.split(';')[0]}});
  assert.deepEqual(await (await session()).json(), {id: 'owner', projectId: 'p', role: 'owner', contactId: null});
  assert.equal((await db.prepare('SELECT password_hash FROM credentials').first()).password_hash, 'retained-existing-hash');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM users').first()).n, 1);
  await db.prepare("UPDATE sessions SET revoked_at=1").run();
  assert.equal((await session()).status, 401, 'Normal session revocation applies');
  await db.batch([
    db.prepare("INSERT INTO users VALUES('second','second@example.test','Second',1)"),
    db.prepare("INSERT INTO memberships VALUES('p','second','owner')"),
  ]);
  assert.equal((await login()).status, 409, 'Multiple owners are ambiguous');
  await db.prepare("DELETE FROM memberships WHERE user_id='second'").run();
  await db.prepare("INSERT INTO project_settings VALUES('p','{\"deleted_at\":1}',1)").run();
  assert.equal((await login()).status, 409, 'Deleted workspaces cannot confer authority');
  console.log('Local owner login passed: real D1/workerd, browser origin fences, existing owner and credential preservation, ordinary session/revocation, ambiguous/deleted owner denial.');
} finally {
  await runtime.dispose();
}
