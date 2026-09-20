import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeEmail, emailEnvironment } from '../scripts/installer/email.mjs';
import { createSecretVault } from '../scripts/installer/secrets.mjs';
import { mergeAgentDraft, secretReady } from '../scripts/installer/ui/model.mjs';
import { startInstaller } from '../scripts/installer/server.mjs';

const accountA = 'a'.repeat(32), accountB = 'b'.repeat(32), fixtureKey = 'test-only-private-key';
const cloudflare = { EMAIL_PROVIDER:'cloudflare', EMAIL_ACCOUNT_ID:accountA, EMAIL_FROM:'owner@example.test', EMAIL_API_KEY:fixtureKey };
assert.throws(() => normalizeEmail({provider:'resend'}, cloudflare), /API token/);
assert.throws(() => normalizeEmail({provider:'cloudflare',accountId:accountA}, {...cloudflare,EMAIL_PROVIDER:'resend'}), /API token/);
assert.throws(() => normalizeEmail({provider:'cloudflare',accountId:accountB}, cloudflare), /API token/);
assert.equal(normalizeEmail({provider:'cloudflare',accountId:accountA}, cloudflare).apiKey, fixtureKey);
assert.equal(normalizeEmail({provider:'resend',apiKey:'explicit-test-key'}, cloudflare).apiKey, 'explicit-test-key');
const sendgrid = { EMAIL_PROVIDER:'sendgrid', EMAIL_FROM:'help@justevery.com', EMAIL_API_KEY:'sendgrid-fixture-key' };
assert.deepEqual(normalizeEmail({}, sendgrid), { provider:'sendgrid', from:'help@justevery.com', accountId:'', apiKey:'sendgrid-fixture-key' });
assert.deepEqual(emailEnvironment(normalizeEmail({}, sendgrid)), sendgrid);
assert.throws(() => normalizeEmail({provider:'sendgrid'}, { EMAIL_PROVIDER:'resend', EMAIL_API_KEY:'resend-fixture-key', EMAIL_FROM:'help@justevery.com' }), /API token/);

const vault=createSecretVault(), draft={emailProvider:'cloudflare',emailAccountId:accountA};
vault.set({emailApiKey:fixtureKey},draft);
assert.equal(vault.readiness(draft).emailApiKey,true);
const changed={...draft,emailAccountId:accountB};
assert.equal(vault.readiness(changed).emailApiKey,false);
assert.equal(secretReady('emailApiKey',changed,{secretReadiness:vault.readiness(draft)}),false);
assert.equal(vault.merge({emailConfiguration:{provider:'cloudflare',accountId:accountB}},draft).emailConfiguration.apiKey,undefined);
assert.equal(vault.merge({emailConfiguration:{provider:'cloudflare',accountId:accountA}},draft).emailConfiguration.apiKey,fixtureKey);

const root=await mkdtemp(join(tmpdir(),'h2h-installer-scopes-'));let installer;
try {
 await mkdir(join(root,'scripts/installer/ui'),{recursive:true});
 await writeFile(join(root,'scripts/installer/ui/index.html'),'<head></head><body>Test fixture</body>');
 const originalPath=process.env.PATH;
 try{process.env.PATH='';installer=await startInstaller(root);}finally{process.env.PATH=originalPath;}
 const page=await fetch(installer.origin),html=await page.text();
 const headers={Origin:installer.origin,Cookie:page.headers.get('set-cookie').split(';')[0],'X-Installer-Token':html.match(/name="installer-token" content="([a-f0-9]+)"/)[1],'Content-Type':'application/json'};
 const post=(path,input)=>fetch(installer.origin+path,{method:'POST',headers,body:JSON.stringify(input)});
 const state=async()=>{const response=await fetch(installer.origin+'/api/state',{headers});return response.json();};
 await post('/api/prefill',{name:'First agent update',email:'first@example.test'});
 const first=await state();
 await post('/api/prefill',{ownerName:'Second agent update',email:'second@example.test'});
 const second=await state();
 const merged=mergeAgentDraft({name:'old',ownerName:'old'},second,0);
 assert.equal(merged.name,'First agent update');assert.equal(merged.ownerName,'Second agent update');
 assert.equal(mergeAgentDraft({name:'pending local edit'},second,0,['name']).name,'pending local edit');
 const password='test-only-private-password';
 assert.equal((await post('/api/secrets',{revision:first.lastUpdate.revision,secrets:{password}})).status,400);
 assert.equal((await state()).known.secretReadiness.password,false);
 assert.equal((await post('/api/secrets',{revision:second.lastUpdate.revision,secrets:{password}})).status,200);
 const final=await state();assert.equal(final.known.secretReadiness.password,true);assert.equal(final.known.secretReadiness.ownerEmail,'second@example.test');
 assert.ok(!JSON.stringify(final).includes(password));assert.equal(final.phase,'ready');
 console.log('Installer scope regressions passed: provider/account credential isolation, scoped vault/UI readiness, multiple agent updates, stale-revision credential rejection. No installation or provider action.');
} finally {await installer?.close();await rm(root,{recursive:true,force:true});}
