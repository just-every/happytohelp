import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,cp,rm,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {execute} from '../scripts/installer/commands.mjs';
import {installationFailureMessage} from '../scripts/base-onboarding/failures.mjs';
const wrongNode=process.env.HTH_TEST_OLD_NODE;
assert.ok(wrongNode,'Provide an actual older Node binary through HTH_TEST_OLD_NODE');
const root=await mkdtemp(join(tmpdir(),'h2h-failure-'));let child;
const password='private-test-password-never-display';
try{
 await mkdir(join(root,'scripts/installer'),{recursive:true});await cp(new URL('../scripts/installer/ui',import.meta.url),join(root,'scripts/installer/ui'),{recursive:true});
 async function open(node,resume){
  const code=`import {startInstaller} from ${JSON.stringify(new URL('../scripts/installer/server.mjs',import.meta.url).href)};const server=await startInstaller(${JSON.stringify(root)},${JSON.stringify(resume?{resume:true}:{noPrefill:true})});console.log(server.origin);process.on('SIGTERM',async()=>{await server.close();process.exit()});`;
  child=spawn(node,['--input-type=module','-e',code],{env:{...process.env,PATH:root},stdio:['ignore','pipe','inherit']});
  const origin=await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',data=>resolve(data.toString().trim()));child.once('exit',()=>reject(Error('Server exited')))});
  const response=await fetch(origin),html=await response.text();assert.equal(response.status,200);
  const headers={Origin:origin,Cookie:response.headers.get('set-cookie').split(';')[0],'X-Installer-Token':html.match(/name="installer-token" content="([a-f0-9]+)"/)[1],'Content-Type':'application/json'};
  return async(path,body)=>{const response=await fetch(origin+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});assert.ok(response.ok);return response.json()};
 }
 async function close(){const exited=once(child,'exit');child.kill('SIGTERM');await exited;child=undefined;}
 const draft={name:'Preserved independent workspace',ownerName:'Independent owner',email:'owner@example.test',password,allowedOrigin:'https://example.test',primaryColor:'#7542d3',target:'local',emailConfiguration:{provider:'later'}};
 for(const [node,resume,expected] of [[wrongNode,false,/Node.js 26\.8\.1/],[process.execPath,true,/pnpm was not found/]]){
  const api=await open(node,resume);if(resume)assert.equal((await api('/api/state')).draft.name,draft.name);
  await api('/api/start',draft);let state;
  for(let i=0;i<100;i++){state=await api('/api/state');if(state.phase==='failed')break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(state.phase,'failed');assert.match(state.error,expected);assert.ok(!JSON.stringify(state).includes(password));assert.equal(state.draft.name,draft.name);await close();
 }
 assert.ok(!(await readFile(join(root,'.seed/installer/state.json'),'utf8')).includes(password));
 // Real unsuccessful executable, without synthesizing an application or process result.
 await symlink('/usr/bin/false',join(root,'pnpm'));
 await assert.rejects(execute(root,['private-argument'],{PATH:root},undefined,'dependencies'),e=>/installing dependencies/.test(installationFailureMessage(e))&&!installationFailureMessage(e).includes('private-argument'));
 const abort=new AbortController();abort.abort();await assert.rejects(async()=>execute(root,[],{PATH:root},abort.signal),{name:'AbortError'});
 console.log('Actual older Node failure, missing pnpm, saved-answer resume, command exit, redaction and cancellation passed.');
}finally{if(child){child.kill('SIGTERM');await once(child,'exit')}await rm(root,{recursive:true,force:true})}
