import assert from 'node:assert/strict';
import { derivePrefix, resolveAddress } from '../scripts/installer/address.mjs';
const accountId = 'a'.repeat(32), input = { name: 'Our Café', accountId };
assert.equal(derivePrefix(input.name), 'our-cafe');
assert.equal(derivePrefix('42'), 'h2h-42');
assert.equal(derivePrefix('A'), 'h2h-a');
assert.equal(derivePrefix('a'.repeat(80)).length, 40);
assert.equal(derivePrefix('中文'), '');
let reads = 0;
const fetch = async (url, options) => {
  if (url.endsWith('/settings')) return new Response('', { status: 404 });
  reads++;
  assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`);
  assert.equal(options.headers.Authorization, 'Bearer test-private-token');
  assert.equal(options.redirect, 'error');
  return Response.json({ success: true, result: { subdomain: 'actual-account' } });
};
assert.deepEqual(await resolveAddress('/tmp', { ...input, apiToken: 'test-private-token' }, { env: {}, fetch }), { prefix: 'our-cafe', appOrigin: 'https://our-cafe.actual-account.workers.dev' });
const run = async (file, args, options) => {
  assert.equal(file, 'wrangler'); assert.deepEqual(args, ['auth', 'token', '--json']); assert.equal(options.cwd, '/tmp');
  return JSON.stringify({ type: 'oauth', token: 'test-private-token' });
};
assert.deepEqual(await resolveAddress('/tmp', { ...input, name: '中文', prefix: 'custom-worker' }, { env: {}, run, fetch }), { prefix: 'custom-worker', appOrigin: 'https://custom-worker.actual-account.workers.dev' });
assert.equal(reads, 2);
await assert.rejects(resolveAddress('/tmp', { ...input, accountId: '../attack', apiToken: 'test-private-token' }, { env: {}, fetch }), { code: 'invalid_input' });
await assert.rejects(resolveAddress('/tmp', { ...input, prefix: 'bad.host', apiToken: 'test-private-token' }, { env: {}, fetch }), { code: 'invalid_input' });
assert.equal(reads, 2);
for (const [response, code] of [[new Response('', { status: 403 }), 'cloudflare_permission'], [new Response('', { status: 404 }), 'workers_subdomain_missing'], [Response.json({ success: true, result: { subdomain: 'evil.com/path' } }), 'workers_subdomain_missing'], [Response.json({ success: false, errors: [{ message: 'test-private-token' }] }), 'cloudflare_unavailable']]) {
  await assert.rejects(resolveAddress('/tmp', { ...input, apiToken: 'test-private-token' }, { env: {}, fetch: async () => response }), error => error.code === code && !error.message.includes('test-private-token'));
}
await assert.rejects(resolveAddress('/tmp', input, { env: {}, run: async () => { throw Error('test-private-token'); }, fetch }), error => error.code === 'cloudflare_auth' && !error.message.includes('test-private-token'));
await assert.rejects(resolveAddress('/tmp', { ...input, apiToken: 'test-private-token' }, { env: {}, fetch: async () => { throw Error('test-private-token'); } }), error => error.code === 'cloudflare_unavailable' && !error.message.includes('test-private-token'));
console.log('Installer address resolution passed: verified account metadata, private credentials, overrides, validation and safe errors.');
