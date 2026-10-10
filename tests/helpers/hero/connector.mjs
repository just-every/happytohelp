import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,symlink,writeFile,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
export async function connector({origin,context,projectId,directory}){
 const workdir=join(directory,'assignment'),bin=join(directory,'bin');await mkdir(workdir,{recursive:true});await mkdir(bin);
 const fixture=resolve('tests/helpers/hero/codex.mjs');await chmod(fixture,0o755);await symlink(fixture,join(bin,'codex'));
 const env={...process.env,PATH:bin+':'+process.env.PATH,H2H_LOCAL_CONFIG:join(directory,'connector.json')};
 const response=await context.request.post(origin+`/api/projects/${projectId}/local-agents/pairings`,{data:{}});assert.equal(response.status(),200);const {data}=await response.json();
 const entry=resolve('local-agent/bin/h2h-local.mjs');
 let logs='';
 const start=args=>{const child=spawn(process.execPath,[entry,...args],{cwd:workdir,env,stdio:['ignore','pipe','pipe'],detached:true});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);return child;};
 await new Promise((done,fail)=>{const child=start(['connect','--server',origin,'--code',data.code,'--provider','codex','--name','Hero proof computer','--workdir',workdir]);child.once('error',fail);child.once('exit',code=>code===0?done():fail(Error(logs)));});
 const config=JSON.parse(await readFile(env.H2H_LOCAL_CONFIG));
 const child=start(['run']);
 return{workdir,deviceId:config.device.id,async stop(){if(child.exitCode===null){try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}}await writeFile(join(directory,'connector.log'),logs);}};
}
