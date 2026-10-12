import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const require=createRequire(import.meta.url),exec=promisify(execFile);
const miniflare=require.resolve('miniflare',{paths:[require.resolve('wrangler')]});
const executable=await realpath(process.env.MINIFLARE_WORKERD_PATH??require(require.resolve('workerd',{paths:[miniflare]})).default);
export async function children(){return new Set((await exec('pgrep',['-P',String(process.pid)]).catch(()=>({stdout:''}))).stdout.trim().split(/\s+/).filter(Boolean).map(Number))}
async function owned(pid){
 // comm, never args: generated local secrets can appear in unrelated commands.
 const output=(await exec('ps',['-p',String(pid),'-o','ppid=','-o','comm=']).catch(()=>({stdout:''}))).stdout.trim(),match=output.match(/^(\d+)\s+(.+)$/);
 if(!match||Number(match[1])!==process.pid)return false;
 // Linux comm is a short executable name; /proc binds the actual child binary.
 const path=process.platform==='linux'?`/proc/${pid}/exe`:match[2];
 return await realpath(path).catch(()=>null)===executable;
}
export async function identifyWorkerd(before){const matches=[];for(const pid of await children())if(!before.has(pid)&&await owned(pid))matches.push(pid);assert.equal(matches.length,1,'one newly started direct-parent-owned resolved workerd');return matches[0]}
export async function assertOwnedWorkerd(pid){assert.ok(pid,'owned workerd child identified');assert.equal(await owned(pid),true,'canonical executable and direct parent match before killing')}
export async function assertWorkerdStopped(pid){const output=(await exec('ps',['-p',String(pid),'-o','pid=']).catch(()=>({stdout:''}))).stdout.trim();assert.equal(output,'','started workerd process exited')}
