import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';
import { startInstaller } from '../scripts/installer/server.mjs';
import { createState } from '../scripts/installer/state.mjs';
import { installationCredential } from '../scripts/installer/private.mjs';

const root = await mkdtemp(join(tmpdir(), 'h2h-installer-security-'));
let installer;
const request = (path, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
 const req = httpRequest(installer.origin + path, { method, headers }, res => {
  let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk);
  res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
 });
 req.on('error', reject); req.end(body);
});
try {
 await mkdir(join(root, 'scripts/installer/ui'), { recursive: true });
 await writeFile(join(root, 'scripts/installer/ui/index.html'), '<!doctype html><head></head><body>Installer security fixture</body>');
 const credential = await installationCredential(root, 'https://install.example');
 assert.equal((await installationCredential(root, 'https://install.example')).token, credential.token);
 assert.notEqual((await installationCredential(root, 'https://different.example')).token, credential.token);
 const store = await createState(root);
 await store.draft({ target: 'local', name: 'Security fixture', password: 'never-persist-password', apiToken: 'never-persist-api-token', setupToken: 'never-persist-setup-token' });
 const persisted = await readFile(join(root, '.seed/installer/state.json'), 'utf8');
 for (const secret of ['never-persist-password', 'never-persist-api-token', 'never-persist-setup-token']) assert.ok(!persisted.includes(secret));
 assert.equal((await stat(join(root, '.seed/installer/state.json'))).mode & 0o777, 0o600);
 // Prevent metadata discovery from touching the operator's provider accounts.
 const oldPath = process.env.PATH;
 try { process.env.PATH = join(root, 'no-tools'); installer = await startInstaller(root); }
 finally { process.env.PATH = oldPath; }
 assert.equal(new URL(installer.origin).hostname, '127.0.0.1');
 assert.equal((await request('/', { headers: { Host: 'attacker.example' } })).status, 403);
 const page = await request('/');
 assert.equal(page.status, 200);
 assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
 const rawCookie = page.headers['set-cookie'][0];
 assert.match(rawCookie, /HttpOnly/); assert.match(rawCookie, /SameSite=Strict/);
 const cookie = rawCookie.split(';')[0];
 const token = page.text.match(/name="installer-token" content="([^"]+)"/)[1];
 assert.ok(!installer.origin.includes(token));
 const auth = { Cookie: cookie, 'X-Installer-Token': token, Origin: installer.origin };
 for (const headers of [{}, { Cookie: cookie }, { 'X-Installer-Token': token }, { ...auth, Origin: 'https://hostile.example' }, { ...auth, Host: 'hostile.example' }, { ...auth, 'X-Installer-Token': 'wrong' }]) {
  assert.equal((await request('/api/state', { headers })).status, 403);
  assert.equal((await request('/api/start', { method: 'POST', headers, body: '{}' })).status, 403);
  assert.equal((await request('/api/address', { method: 'POST', headers, body: '{}' })).status, 403);
 }
 const { Origin: ignored, ...noOrigin } = auth;
 assert.equal((await request('/api/start', { method: 'POST', headers: noOrigin, body: '{}' })).status, 403);
 const state = await request('/api/state', { headers: auth });
 assert.equal(state.status, 200);
 for (const secret of [credential.token, token, cookie.split('=')[1], 'never-persist-password', 'never-persist-api-token', 'never-persist-setup-token']) assert.ok(!state.text.includes(secret));
 assert.equal((await request('/api/start', { method: 'POST', headers: auth, body: '{' })).status, 400);
 assert.equal((await request('/api/arbitrary-command', { method: 'POST', headers: auth, body: '{}' })).status, 404);
 assert.equal((await request('/.seed/installer/state.json')).status, 404);
 assert.equal(installer.state.phase, 'ready');
 console.log('Installer security passed: loopback, Host/Origin, cookie+CSRF, private credential-free drafts/status, protected mutation routes. No installation or provider action executed.');
} finally {
 await installer?.close();
 await rm(root, { recursive: true, force: true });
}
