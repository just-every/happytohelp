import assert from 'node:assert/strict';
import { cp, mkdtemp, access, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { startInstaller } from '../scripts/installer/server.mjs';
const directory=await mkdtemp(join(tmpdir(),'h2h-fresh-install-'));
const excluded=new Set(['node_modules','.git','.seed','.wrangler','dist','.dev.vars','.env','.env.local','evidence']);
await cp(process.cwd(),directory,{recursive:true,filter:source=>!excluded.has(basename(source))});
await assert.rejects(access(join(directory,'node_modules')));
const installer=await startInstaller(directory);let completed=false;
try{
 const response=await fetch(installer.origin);assert.equal(response.status,200);const html=await response.text();const token=html.match(/name="installer-token" content="([a-f0-9]+)"/)[1];const cookie=response.headers.get('set-cookie').split(';')[0];const headers={'X-Installer-Token':token,Cookie:cookie,Origin:installer.origin,'Content-Type':'application/json'};
 assert.equal((await fetch(installer.origin+'/api/state')).status,403);
 assert.equal((await fetch(installer.origin+'/api/state',{headers:{...headers,Origin:'https://example.com'}})).status,403);
 await assert.rejects(access(join(directory,'node_modules')));
 const payload={target:'local',ownerName:'Installer owner',email:'installer@example.test',password:'test-installer-owner-password',name:'Installed workspace',allowedOrigin:'https://example.test',primaryColor:'#7766cc'};
 assert.equal((await fetch(installer.origin+'/api/start',{method:'POST',headers,body:JSON.stringify(payload)})).status,202);
 let state;for(let i=0;i<480;i++){state=await(await fetch(installer.origin+'/api/state',{headers})).json();assert.ok(!JSON.stringify(state).includes(payload.password));if(state.phase!=='running')break;await new Promise(resolve=>setTimeout(resolve,500))}
 assert.equal(state.phase,'complete',JSON.stringify(state));assert.ok(state.appUrl.endsWith('/login'));
 const persisted=await readFile(join(directory,'.seed/installer/state.json'),'utf8');assert.ok(!persisted.includes(payload.password));
 const app=new URL(state.appUrl).origin;assert.equal((await(await fetch(app+'/api/identity/setup')).json()).available,false);
 completed=true;await writeFile(join(directory,'installer-result.json'),JSON.stringify({complete:true,noDependenciesAtLaunch:true,state},null,2));console.log('Standalone fresh install passed: '+directory);
}finally{await installer.close();if(!completed)console.error('Failed installer evidence: '+directory)}
