import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWebsite, setupModel, initialDraft, safeDraft, safeKeys, installInput, mergeAgentDraft, derivePrefix, normalizeAutomaticDraft, emailModel } from './model.mjs';
const complete = { name: 'Support', ownerName: 'Owner', email: 'owner@example.com', password: 'long-password-123', allowedOrigin: 'https://example.com', primaryColor: '#7c3aed', target: 'local', emailProvider: 'later' };

test('automatic resource names are stable, readable and bounded', () => {
  assert.equal(derivePrefix(' Café support / 24 '), 'cafe-support-24');
  assert.equal(derivePrefix('A'), 'h2h-a');
  assert.equal(derivePrefix('!!!'), '');
  assert.ok(derivePrefix('A'.repeat(80)).length <= 40);
});

test('automatic hosting normalization derives only automatic values and preserves custom values', () => {
  const automatic = normalizeAutomaticDraft({ name: 'North Star Outfitters', prefixMode: 'automatic', prefix: 'stale-prefix', addressMode: 'automatic' });
  assert.equal(automatic.prefix, 'north-star-outfitters');
  assert.equal(automatic.prefixMode, 'automatic');
  assert.equal(automatic.addressMode, 'automatic');

  const custom = { name: 'North Star Outfitters', prefixMode: 'custom', prefix: 'chosen-prefix', addressMode: 'custom', appOrigin: 'https://team.example.test' };
  assert.deepEqual(normalizeAutomaticDraft(custom), custom);
  assert.equal(custom.prefix, 'chosen-prefix');
});

test('initial drafts infer custom modes from explicit hosting answers and retain explicit automatic mode', () => {
  const inferred = initialDraft({ draft: { name: 'Support', prefix: 'support-prod', appOrigin: 'https://help.example.test' } });
  assert.equal(inferred.prefixMode, 'custom');
  assert.equal(inferred.addressMode, 'custom');
  assert.equal(inferred.prefix, 'support-prod');
  assert.equal(inferred.appOrigin, 'https://help.example.test');

  const explicit = initialDraft({ draft: { name: 'Support', prefixMode: 'automatic', prefix: 'old-prefix', addressMode: 'custom', appOrigin: 'https://help.example.test' } });
  assert.equal(explicit.prefixMode, 'automatic');
  assert.equal(explicit.prefix, 'support');
  assert.equal(explicit.addressMode, 'custom');
  assert.equal(explicit.appOrigin, 'https://help.example.test');
});

test('safe drafts retain hosting modes while excluding credentials', () => {
  assert.ok(safeKeys.includes('prefixMode'));
  assert.ok(safeKeys.includes('addressMode'));
  const safe = safeDraft({ ...complete, prefixMode: 'custom', addressMode: 'automatic', password: 'secret', apiToken: 'secret', emailApiKey: 'secret' });
  assert.equal(safe.prefixMode, 'custom');
  assert.equal(safe.addressMode, 'automatic');
  assert.equal(safe.password, undefined);
  assert.equal(safe.apiToken, undefined);
  assert.equal(safe.emailApiKey, undefined);
});

test('email model keeps provider, sender, account and credential requirements together', () => {
  assert.deepEqual(emailModel({ emailProvider: 'later' }), { keys: ['emailProvider'], complete: true });

  const resend = { emailProvider: 'resend', emailFrom: 'help@example.test' };
  assert.deepEqual(emailModel(resend), { keys: ['emailProvider', 'emailFrom', 'emailApiKey'], complete: false });
  assert.equal(emailModel({ ...resend, emailApiKey: 'resend-key' }).complete, true);
  assert.equal(emailModel(resend, { secretReadiness: { emailApiKey: true, emailProvider: 'resend' } }).complete, true);

  const sendgrid = { emailProvider: 'sendgrid', emailFrom: 'help@support.example.com' };
  assert.deepEqual(emailModel(sendgrid), { keys: ['emailProvider', 'emailFrom', 'emailApiKey'], complete: false });
  assert.equal(emailModel({ ...sendgrid, emailApiKey: 'sendgrid-key' }).complete, true);
  assert.equal(emailModel(sendgrid, { secretReadiness: { emailApiKey: true, emailProvider: 'sendgrid' } }).complete, true);

  const cloudflare = { emailProvider: 'cloudflare', emailFrom: 'help@example.test', emailAccountId: 'a'.repeat(32) };
  assert.deepEqual(emailModel(cloudflare), { keys: ['emailProvider', 'emailFrom', 'emailAccountId', 'emailApiKey'], complete: false });
  assert.equal(emailModel(cloudflare, { email: { provider: 'cloudflare', credentialPresent: true, accountId: cloudflare.emailAccountId } }).complete, true);
});

test('all known answers need only install approval', () => { assert.deepEqual(setupModel(complete).missing, []); assert.equal(setupModel(complete).ready, true); });
test('partial answers ask only missing fields, including invalid known values', () => { const model = setupModel({ ...complete, password: '', email: 'bad', primaryColor: '#bad' }); assert.deepEqual(model.missing, ['email', 'password', 'primaryColor']); });
test('remote hosting requires connection, local ignores optional provider state', () => { assert.equal(setupModel(complete).connections.length, 0); const draft = { ...complete, target: 'remote', accountId: 'a'.repeat(32), prefix: 'support', appOrigin: 'https://help.example.com' }; assert.deepEqual(setupModel(draft).connections, ['cloudflare']); assert.equal(setupModel(draft, { providers: { cloudflare: { authenticated: true } } }).ready, true); assert.equal(setupModel({ ...draft, apiToken: 'token' }).ready, true); });
test('email is explicit, configured credentials do not imply provider verification', () => { assert.deepEqual(setupModel({ ...complete, emailProvider: '' }).missing, ['emailProvider']); const draft = { ...complete, emailProvider: 'resend', emailFrom: 'help@example.com' }; assert.deepEqual(setupModel(draft).missing, ['emailApiKey']); assert.equal(setupModel(draft, { email: { provider: 'resend', credentialPresent: true, domainVerification: 'not_checked' } }).ready, true); });
test('edits re-evaluate dependent fields and matching email credential', () => { const draft = { ...complete, emailProvider: 'cloudflare' }; assert.deepEqual(setupModel(draft, { email: { provider: 'resend', credentialPresent: true } }).missing, ['emailFrom', 'emailAccountId', 'emailApiKey']); assert.ok(setupModel({ ...complete, allowedOrigin: 'not a URL' }).missing.includes('allowedOrigin')); });
test('drafts exclude every secret and explicit defer survives reload', () => { const draft = { ...complete, apiToken: 'secret', emailApiKey: 'secret' }; const safe = safeDraft(draft); assert.equal(safe.password, undefined); assert.equal(safe.apiToken, undefined); assert.equal(safe.emailApiKey, undefined); assert.equal(initialDraft({ draft: safe }).emailProvider, 'later'); assert.equal(installInput(draft).emailConfiguration.apiKey, 'secret'); });

test('agent update changes only named safe answers and retains session secrets', () => {
  const current = { ...complete, apiToken: 'private-token', emailApiKey: 'private-email-key' };
  const next = { lastUpdate: { source: 'agent', revision: 2, keys: ['name', 'password', 'apiToken', 'emailApiKey'] }, draft: { name: 'Agent workspace', email: 'unlisted@example.com', password: 'leaked', apiToken: 'leaked', emailApiKey: 'leaked' } };
  const merged = mergeAgentDraft(current, next, 1);
  assert.equal(merged.name, 'Agent workspace'); assert.equal(merged.email, current.email); assert.equal(merged.password, current.password); assert.equal(merged.apiToken, current.apiToken); assert.equal(merged.emailApiKey, current.emailApiKey);
  assert.equal(mergeAgentDraft(current, next, 2), current);
  assert.equal(mergeAgentDraft(current, { ...next, lastUpdate: { ...next.lastUpdate, source: 'browser' } }, 1), current);
});

test('private server readiness completes answers without exposing secrets and invalidates edited bindings', () => {
  const draft = { ...complete, password: '', target: 'remote', accountId: 'a'.repeat(32), prefix: 'support', appOrigin: 'https://help.example.com', emailProvider: 'resend', emailFrom: 'help@example.com' };
  const known = { secretReadiness: { password: true, apiToken: true, emailApiKey: true, ownerEmail: draft.email, accountId: draft.accountId, emailProvider: 'resend' } };
  assert.equal(setupModel(draft, known).ready, true);
  assert.ok(setupModel({ ...draft, email: 'another@example.com' }, known).missing.includes('password'));
  assert.deepEqual(setupModel({ ...draft, accountId: 'b'.repeat(32) }, known).connections, ['cloudflare']);
  assert.ok(setupModel({ ...draft, emailProvider: 'cloudflare', emailAccountId: draft.accountId }, known).missing.includes('emailApiKey'));
  assert.equal(installInput(draft).password, undefined);
});

test('coalesced agent updates merge all agent answers while preserving pending browser edits', () => {
  const state = { lastUpdate: { source: 'browser', revision: 4, keys: ['email'] }, sources: { name: 'agent', ownerName: 'agent', email: 'browser' }, draft: { name: 'Latest workspace', ownerName: 'Agent owner', email: 'server@example.test' } };
  const merged = mergeAgentDraft(complete, state, 1, ['ownerName']);
  assert.equal(merged.name, 'Latest workspace'); assert.equal(merged.ownerName, complete.ownerName); assert.equal(merged.email, complete.email);
});
test('Cloudflare sending vault token is scoped to its email account', () => {
  const draft = { ...complete, emailProvider: 'cloudflare', emailFrom: 'help@example.test', emailAccountId: 'a'.repeat(32) };
  const known = { secretReadiness: { emailApiKey: true, emailProvider: 'cloudflare', emailAccountId: draft.emailAccountId } };
  assert.equal(setupModel(draft, known).ready, true);
  assert.ok(setupModel({ ...draft, emailAccountId: 'b'.repeat(32) }, known).missing.includes('emailApiKey'));
});

test('configured Cloudflare email credentials do not transfer to another account', () => {
  const draft = { ...complete, emailProvider: 'cloudflare', emailFrom: 'help@example.test', emailAccountId: 'a'.repeat(32) };
  const known = { email: { provider: 'cloudflare', credentialPresent: true, accountId: draft.emailAccountId } };
  assert.equal(setupModel(draft, known).ready, true);
  assert.ok(setupModel({ ...draft, emailAccountId: 'b'.repeat(32) }, known).missing.includes('emailApiKey'));
});

 test('hosting completes only as one unit and local preserves remote draft values', async () => {
  const { hostingModel } = await import('./model.mjs');
  const remote = { target: 'remote', accountId: 'a'.repeat(32), prefix: 'test-host', appOrigin: 'https://app.example.test' };
  assert.equal(hostingModel({}).complete, false);
  assert.equal(hostingModel(remote).complete, false);
  assert.equal(hostingModel({ ...remote, apiToken: 'test-token' }).complete, true);
  assert.equal(hostingModel(remote, { providers: { cloudflare: { authenticated: true } } }).complete, true);
  assert.equal(hostingModel({ ...remote, appOrigin: '' }, { providers: { cloudflare: { authenticated: true } } }).complete, false);
  assert.equal(hostingModel({ ...remote, target: 'local' }).complete, true);
});


test('group entry skips all complete groups including optional GitHub', async () => {
  const { nextIncompleteGroup, setupGroups } = await import('./model.mjs');
  assert.equal(nextIncompleteGroup({}), 'workspace');
  assert.equal(nextIncompleteGroup(complete), null);
  assert.equal(nextIncompleteGroup({ ...complete, password: '' }), 'owner');
  assert.equal(nextIncompleteGroup({ ...complete, target: '' }), 'hosting');
  assert.equal(nextIncompleteGroup({ ...complete, emailProvider: '' }), 'hosting');
  assert.equal(setupGroups.find(group => group.id === 'owner').complete({ ...complete, password: '' }, { secretReadiness: { password: true, ownerEmail: complete.email } }), true);
  assert.equal(nextIncompleteGroup({ ...complete, target: 'remote', accountId: 'a'.repeat(32), prefix: 'support', appOrigin: 'https://support.example.test' }), 'hosting');
});

test('hosting and email form one required group with one combined known summary', async () => {
  const { setupGroups, nextIncompleteGroup } = await import('./model.mjs');
  assert.deepEqual(setupGroups.map(group => group.id), ['workspace', 'owner', 'hosting']);
  const hosting = setupGroups.find(group => group.id === 'hosting');
  assert.ok(hosting.keys.includes('emailProvider'));
  assert.ok(hosting.keys.includes('emailFrom'));
  assert.equal(hosting.complete(complete), true);
  assert.equal(hosting.complete({ ...complete, target: '' }), false);
  assert.equal(hosting.complete({ ...complete, emailProvider: '' }), false);
  assert.equal(hosting.complete({ ...complete, emailProvider: 'resend', emailFrom: 'help@example.test' }), false);
  assert.equal(hosting.complete({ ...complete, emailProvider: 'resend', emailFrom: 'help@example.test', emailApiKey: 'fixture-token' }), true);
  assert.equal(nextIncompleteGroup({ ...complete, emailProvider: '' }), 'hosting');
  assert.equal(nextIncompleteGroup(complete), null);
});

test('progress counts the actual journey and holds completed current steps until Continue', async () => {
  const { setupProgress } = await import('./model.mjs');
  const owner = { ownerName: complete.ownerName, email: complete.email, password: complete.password };
  assert.equal(setupProgress(owner, {}, { active: 'workspace', visited: ['workspace'] }), 'Step 1 of 2');
  const workspaceAndOwner = { ...owner, name: complete.name, allowedOrigin: complete.allowedOrigin, primaryColor: complete.primaryColor };
  assert.equal(setupProgress(workspaceAndOwner, {}, { active: 'workspace', visited: ['workspace'] }), 'Step 1 of 2');
  assert.equal(setupProgress(workspaceAndOwner, {}, { active: 'hosting', visited: ['workspace', 'hosting'] }), 'Step 2 of 2');
  assert.equal(setupProgress({ ...workspaceAndOwner, target: 'local' }, {}, { active: 'hosting', visited: ['workspace', 'hosting'] }), 'Step 2 of 2');
  assert.equal(setupProgress(complete, {}, { active: 'hosting', visited: ['workspace', 'hosting'] }), 'Step 2 of 2');
  assert.equal(setupProgress({}, {}, { active: 'workspace', visited: ['workspace'] }), 'Step 1 of 3');
  assert.equal(setupProgress({ name: complete.name, allowedOrigin: complete.allowedOrigin, primaryColor: complete.primaryColor }, {}, { active: 'owner', visited: ['workspace', 'owner'] }), 'Step 2 of 3');
});

test('future prefill adjusts the remaining total only when hosting and email are both known', async () => {
  const { setupProgress } = await import('./model.mjs');
  const journey = { active: 'owner', visited: ['workspace', 'owner'] };
  const draft = { ...complete, target: '', emailProvider: '' };
  assert.equal(setupProgress(draft, {}, journey), 'Step 2 of 3');
  assert.equal(setupProgress({ ...draft, emailProvider: 'later' }, {}, journey), 'Step 2 of 3');
  assert.equal(setupProgress({ ...draft, target: 'local' }, {}, journey), 'Step 2 of 3');
  assert.equal(setupProgress(complete, {}, journey), 'Step 2 of 2');
  assert.equal(setupProgress({ ...complete, emailProvider: 'resend' }, {}, journey), 'Step 2 of 3');
});

test('Back retains journey positions and Edit does not inflate numbered steps', async () => {
  const { setupProgress } = await import('./model.mjs');
  const visited = ['workspace', 'hosting'];
  assert.equal(setupProgress(complete, {}, { active: 'hosting', visited }), 'Step 2 of 2');
  assert.equal(setupProgress(complete, {}, { active: 'workspace', visited }), 'Step 1 of 2');
  assert.equal(setupProgress(complete, {}, { active: 'owner', visited, editing: true }), 'Editing Your account');
  assert.equal(setupProgress(complete, {}, { active: 'hosting', visited, editing: true }), 'Editing Hosting & connections');
  assert.deepEqual(visited, ['workspace', 'hosting']);
  assert.equal(setupProgress(complete), 'Your choices are ready');
  assert.equal(setupProgress(complete, {}, { active: 'owner', editing: true }), 'Editing Your account');
  assert.equal(setupProgress(complete, {}, { active: null, visited }), 'Your choices are ready');
});


test('website commits add HTTPS only for bare addresses and leave empty or explicit schemes intact', () => {
  assert.equal(normalizeWebsite('example.com'), 'https://example.com');
  assert.equal(normalizeWebsite(' example.com/path '), 'https://example.com/path');
  assert.equal(normalizeWebsite('http://example.com'), 'http://example.com');
  assert.equal(normalizeWebsite('https://example.com'), 'https://example.com');
  assert.equal(normalizeWebsite(''), '');
  assert.equal(normalizeWebsite('   '), '');
  assert.equal(normalizeWebsite('localhost:3000'), 'https://localhost:3000');
  assert.equal(normalizeWebsite('ftp://example.com'), 'ftp://example.com');
  assert.equal(normalizeWebsite(normalizeWebsite('example.com')), 'https://example.com');
});
