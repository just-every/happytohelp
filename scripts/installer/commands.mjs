import { spawn } from 'node:child_process';
import { installationFailure } from '../base-onboarding/failures.mjs';
import { stopChild } from './private.mjs';
export function assertNodeVersion(){
 const [major,minor,patch]=process.versions.node.split('.').map(Number);
 if(major<26||(major===26&&(minor<8||(minor===8&&patch<1))))throw installationFailure('node_version',{version:'26.8.1'});
}
export function commandFailure(error,step){
 return error?.code==='ENOENT'?installationFailure('missing_tool',{tool:'pnpm'}):installationFailure('command_failed',{step});
}
export function execute(root,args,env,signal,step='setup'){
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const child=spawn('pnpm',args,{cwd:root,env,stdio:'ignore',shell:false,detached:true});
  const abort=()=>{stopChild(child);reject(signal.reason)};
  const cleanup=()=>signal?.removeEventListener('abort',abort);
  signal?.addEventListener('abort',abort,{once:true});
  child.once('error',error=>{cleanup();reject(commandFailure(error,step))});
  child.once('exit',code=>{cleanup();if(signal?.aborted)reject(signal.reason);else if(code===0)resolve();else reject(installationFailure('command_failed',{step}))});
 });
}
