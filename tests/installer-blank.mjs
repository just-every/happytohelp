import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startInstaller } from '../scripts/installer/server.mjs';
import { initialDraft, setupModel } from '../scripts/installer/ui/model.mjs';
const root=await mkdtemp(join(tmpdir(),'h2h-blank-'));
const previous={...process.env}; let server;
try {
 await mkdir(join(root,'scripts/installer'),{recursive:true});
 await cp(new URL('../scripts/installer/ui',import.meta.url),join(root,'scripts/installer/ui'),{recursive:true});
 Object.assign(process.env,{EMAIL_PROVIDER:'resend',EMAIL_FROM:'private@example.test',EMAIL_API_KEY:'test-secret',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-cloudflare-secret'});
 server=await startInstaller(root,{noPrefill:true});
 const page=await fetch(server.origin),html=await page.text();
 const headers={Cookie:page.headers.get('set-cookie').split(';')[0],'X-Installer-Token':html.match(/name="installer-token" content="([a-f0-9]+)"/)[1]};
 const state=await(await fetch(server.origin+'/api/state',{headers})).json();
 assert.deepEqual(state.draft,{});assert.deepEqual(state.known.providers,{});assert.equal(state.known.email,undefined);assert.equal(state.known.name,undefined);
 const {prefixMode,addressMode,...visibleDraft}=initialDraft(state);
 assert.equal(prefixMode,'automatic');assert.equal(addressMode,'automatic');
 assert.ok(Object.values(visibleDraft).every(value=>value===''));
 for(const key of ['target','primaryColor','ownerName','email'])assert.ok(setupModel(initialDraft(state),state.known).missing.includes(key));
 assert.ok(!JSON.stringify(state).includes('test-secret'));assert.ok(!JSON.stringify(state).includes('private@example.test'));
 await server.close();server=undefined;
 const file=join(root,'.seed/installer/state.json'),saved=JSON.stringify({draft:{name:'Existing draft'}});await writeFile(file,saved);
 await assert.rejects(startInstaller(root,{noPrefill:true}),/Existing drafts are preserved/);assert.equal(await readFile(file,'utf8'),saved);
 console.log('Blank installer API passed: no answers, target, colour, environment email, provider account or credentials; saved draft preserved.');
} finally { await server?.close(); for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);await rm(root,{recursive:true,force:true}); }
