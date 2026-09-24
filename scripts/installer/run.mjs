import { installationFailure } from '../base-onboarding/failures.mjs';
import { execute, commandFailure, assertNodeVersion } from './commands.mjs';
export { execute } from './commands.mjs';
import { randomBytes } from 'node:crypto';
import { emailEnvironment } from './email.mjs';
import { persistLocalEmail } from './private.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { installationCredential, localSetupToken } from './private.mjs';
import { assertWorkerAvailable } from './address.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function port(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const value=server.address().port;await new Promise(resolve=>server.close(resolve));return value}
export async function install(root,input,store,onApp,signal,artworkBridge){
 const env={...process.env};delete env.H2H_LOCAL_OWNER_LOGIN;delete env.CLOUDFLARE_ENV;delete env.H2H_WRANGLER_CONFIG;
 await store.phase('running');store.state.error=null;store.state.logs=[];
 try{
  assertNodeVersion();
  Object.assign(env,emailEnvironment(input.emailConfiguration||{provider:'later'}));
  if(input.target==='local'&&input.emailConfiguration?.provider!=='later')await persistLocalEmail(root,emailEnvironment(input.emailConfiguration));
  await store.step('Installing locked dependencies');await execute(root,['install','--frozen-lockfile'],env,signal,'dependencies');
  let appUrl,credential;
  if(input.target==='remote'){
   await store.step('Checking the Cloudflare workspace name');await assertWorkerAvailable(root,input,{env});
   Object.assign(env,{CLOUDFLARE_ACCOUNT_ID:input.accountId,...(input.apiToken?{CLOUDFLARE_API_TOKEN:input.apiToken}:{}),H2H_RESOURCE_PREFIX:input.prefix,H2H_PUBLIC_ORIGIN:input.appOrigin,H2H_SETUP_TOKEN:(credential=await installationCredential(root,input.appOrigin,{accountId:input.accountId,prefix:input.prefix})).token,H2H_SETUP_OWNER_EMAIL:input.email});
   if(!credential.deployed){
   await store.step('Preparing Cloudflare resources and migrations');await execute(root,['run','setup','--','--remote'],env,signal,'setup');
   await assertWorkerAvailable(root,input,{env});
   await store.step('Building and deploying the app');await execute(root,['run','deploy','--','--remote'],env,signal,'deploy');await credential.markDeployed();
   }else await store.step('Resuming owner setup on the previously deployed app');
   appUrl=input.appOrigin;
  }else{
   await store.step('Preparing local database');await execute(root,['run','setup','--','--local'],env,signal,'setup');
   env.H2H_INSTALLER_NONCE=randomBytes(24).toString('hex');
   const appPort=await port();appUrl=`http://127.0.0.1:${appPort}`;
   await store.step('Building assets and starting the local app');
   const child=spawn('pnpm',['run','dev','--host','127.0.0.1','--port',String(appPort),'--strictPort'],{cwd:root,env,stdio:'ignore',shell:false,detached:true});onApp(child);
   let startError;child.once('error',error=>{startError=commandFailure(error,'start');});
   let ready=false;for(let attempt=0;attempt<240;attempt++){signal?.throwIfAborted();if(startError)throw startError;if(child.exitCode!==null)throw installationFailure('command_failed',{step:'start'});try{ready=(await fetch(appUrl+'/health',{signal:AbortSignal.timeout(2000)})).ok}catch{}if(ready)break;await delay(500)}if(!ready)throw installationFailure('command_failed',{step:'start'});
   const identity=await fetch(appUrl+'/__installer/identity',{signal:AbortSignal.timeout(5000)});if(!identity.ok||(await identity.json()).nonce!==env.H2H_INSTALLER_NONCE)throw Error('The selected local port does not belong to this installation. Owner setup was not attempted.');
  }
  signal?.throwIfAborted();store.state.appUrl=appUrl+'/setup';
  await store.step('Checking first-owner setup');
  const available=await fetch(appUrl+'/api/identity/setup',{signal:AbortSignal.timeout(15000)});if(!available.ok)throw Error('The app is running but setup availability could not be checked.');const setup=await available.json();
  if(setup.available){
   await store.step('Creating your owner account and workspace');
   const result=await fetch(appUrl+'/api/identity/bootstrap',{method:'POST',headers:{'Content-Type':'application/json','Origin':appUrl},body:JSON.stringify({ownerName:input.ownerName,name:input.name,email:input.email,password:input.password,allowedOrigin:input.allowedOrigin,primaryColor:input.primaryColor,setupToken:env.H2H_SETUP_TOKEN || await localSetupToken(root)}),signal:AbortSignal.timeout(30000)});
   if(!result.ok)throw Error('The app is ready but owner setup was not accepted. Open its setup page to complete it with the installation credential.');
   const owner=await result.json();if(artworkBridge){try{await artworkBridge.attach({origin:appUrl,token:owner.token,userId:owner.userId,projectId:owner.projectId});}catch{await store.step('Workspace created; open the app to finish applying your artwork.');}}if(credential)await credential.clear();store.state.appUrl=appUrl+'/login';await store.step('Workspace created. Sign in with the password you chose.');
  }else{artworkBridge?.close();if(credential)await credential.clear();store.state.appUrl=appUrl+'/login';await store.step('Existing owner detected. Owner data was preserved; installation steps have completed. Sign in to continue.');}
  await store.phase('complete');
 }finally{input.password='';input.apiToken='';if(input.emailConfiguration)input.emailConfiguration.apiKey='';delete env.CLOUDFLARE_API_TOKEN;delete env.H2H_SETUP_TOKEN;}
}
