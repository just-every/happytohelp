import assert from 'node:assert/strict';
import { startApp, sha } from '../../journeys/kit/app.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1cAAAAASUVORK5CYII=', 'base64');

// Workspace artwork through the management routes on real D1 and R2: shared member reads, role permissions,
// tenant isolation, bootstrap, atomic context guards, concurrent cleanup and validation.
export async function artworkJourney() {
  const app = await startApp({ origin: 'https://app.test' }), db = app.db, hashToken = async value => sha(value);
  try {
  for (const project of ['p', 'q']) await db.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,1)').bind(project, project, project, 'https://widget.test').run();
  for (const [token, project, role] of [['owner','p','owner'], ['admin','p','admin'], ['operator','p','operator'], ['outsider','q','owner']]) {
    await db.prepare('INSERT INTO users VALUES(?,?,?,1)').bind(token, token + '@example.test', token).run();
    await db.prepare('INSERT INTO memberships VALUES(?,?,?)').bind(project, token, role).run();
    await db.prepare('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)').bind(await hashToken(token), token, project, role, Date.now() + 999999).run();
  }
  const base = '/api/management/projects/p';
  const request = (path, { token = 'owner', method = 'GET', body, type = 'application/json', headers = {} } = {}) => app.request(path, { raw: true,
    method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': type, ...headers },
    body: body === undefined ? undefined : type === 'application/json' ? JSON.stringify(body) : body,
  });
  const appearance = async () => {
    const response = await request(base + '/appearance');
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).data;
  };
  const upload = (options = {}) => request(base + '/artwork', { method: 'PUT', body: png, type: 'image/png', ...options });
  const update = (body, token = 'owner') => request(base + '/appearance', { method: 'PUT', body, token });
  const context = { website: 'https://widget.test', name: 'p', primaryColor: '#713ee0' };
  assert.deepEqual(await appearance(), { ...context, artwork_url: null, artwork_enabled: false });
  assert.equal((await upload({ token: '' })).status, 401);
  assert.equal((await upload({ token: 'operator' })).status, 403);
  assert.equal((await update({ artwork_enabled: true }, 'operator')).status, 403);
  assert.equal((await upload({ token: 'outsider' })).status, 403);
  const guards = { 'x-h2h-expected-workspace': encodeURIComponent(JSON.stringify(context)), 'x-h2h-expected-artwork': 'none' };
  const keys = async () => (await (await app.files).list({ prefix: 'workspace-artwork/p/' })).objects.map(object => object.key).sort();
  for (const headers of [
    { 'x-h2h-expected-workspace': guards['x-h2h-expected-workspace'] },
    { 'x-h2h-expected-artwork': 'none' },
    { ...guards, 'x-h2h-expected-workspace': '%GG' },
    { ...guards, 'x-h2h-expected-workspace': encodeURIComponent('{') },
  ]) assert.equal((await upload({ headers })).status, 400, 'invalid workspace guards');
  for (const [key, value] of [['website', 'https://old.test'], ['name', 'Old name'], ['primaryColor', '#ffffff']]) {
    const headers = { ...guards, 'x-h2h-expected-workspace': encodeURIComponent(JSON.stringify({ ...context, [key]: value })) };
    assert.equal((await upload({ headers })).status, 409, key + ' drift rejects generated artwork');
    assert.deepEqual(await keys(), [], 'stale context cleans uploaded R2 bytes');
  }
  const contenders = await Promise.all([upload({ headers: guards }), upload({ headers: guards, token: 'admin' })]);
  assert.deepEqual(contenders.map(response => response.status).sort(), [200, 409], 'one atomic workspace upload wins');
  const saved = (await contenders.find(response => response.status === 200).json()).data;
  assert.match(saved.artwork_url, /^\/api\/management\/projects\/p\/artwork\/[^/]+$/);
  assert.equal(saved.artwork_enabled, true);
  const expected = { ...context, artwork_url: saved.artwork_url, artwork_enabled: true };
  assert.deepEqual(await appearance(), expected);
  const winnerKeys = ['workspace-artwork/p/' + saved.artwork_url.split('/').at(-1)];
  assert.deepEqual(await keys(), winnerKeys, 'concurrent loser leaves no R2 object');
  assert.equal((await upload({ headers: guards })).status, 409, 'guard cannot replace existing artwork');
  assert.deepEqual(await keys(), winnerKeys);
  for (const token of ['owner', 'admin', 'operator']) {
    const response = await request(saved.artwork_url, { token });
    assert.equal(response.status, 200, 'every workspace member can read artwork');
    assert.match(response.headers.get('content-type'), /^image\/png/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    const bootstrap = await request('/api/management/bootstrap', { token });
    assert.equal(bootstrap.status, 200);
    const data = await bootstrap.json();
    assert.equal(data.personalAppearance, undefined);
    assert.equal(data.projects.p.sidebar_artwork_url, saved.artwork_url);
    assert.equal(data.projects.p.sidebar_artwork_enabled, true);
  }
  assert.equal((await request(saved.artwork_url, { token: '' })).status, 401);
  assert.ok([403, 404].includes((await request(saved.artwork_url, { token: 'outsider' })).status));
  const foreignPath = saved.artwork_url.replace('/projects/p/', '/projects/q/');
  assert.equal((await request(foreignPath, { token: 'outsider' })).status, 404, 'artwork ID is scoped to workspace');
  assert.equal((await update({ artwork_enabled: false }, 'admin')).status, 200);
  const disabled = { ...expected, artwork_enabled: false };
  assert.deepEqual(await appearance(), disabled);
  assert.equal((await update({ artwork_enabled: 'false' })).status, 400);
  const dimensions = Buffer.from(png); dimensions.writeUInt32BE(8193, 16);
  for (const [body, type, status] of [[png,'image/jpeg',400], [Buffer.from('invalid'),'image/png',400], [dimensions,'image/png',400], [Buffer.alloc(12 * 1024 * 1024 + 1),'image/png',413]]) {
    assert.equal((await upload({ body, type })).status, status);
    assert.deepEqual(await appearance(), disabled, 'invalid upload preserves workspace artwork');
  }
  const replacement = await upload();
  assert.equal(replacement.status, 200);
  const replaced = (await replacement.json()).data;
  assert.notEqual(replaced.artwork_url, saved.artwork_url);
  assert.equal(replaced.artwork_enabled, true);
  assert.equal((await request(saved.artwork_url)).status, 404);
  assert.deepEqual(await keys(), ['workspace-artwork/p/' + replaced.artwork_url.split('/').at(-1)]);
  const settings = JSON.parse((await db.prepare("SELECT settings_json FROM project_settings WHERE project_id='p'").first()).settings_json);
  assert.equal(settings.sidebar_artwork_id, replaced.artwork_url.split('/').at(-1));
  assert.equal(settings.sidebar_artwork_enabled, true);
  } finally { await app.close(); }
}
