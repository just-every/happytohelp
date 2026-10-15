import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {prepareNativeLocal,nativeOwner} from '../../scripts/installer/native-local.mjs';
import {adapter,commandAdapter} from '../../scripts/installer/local.mjs';
import {readySummary} from '../../scripts/installer/ui/seed.mjs';
import {loadInstallerSeed} from '@runeditrun/rer/setup-manifest';
import {prepareSettings} from '@runeditrun/rer/adapter-settings';
import {validateRuntimeEnvironment,runtimeVariables} from '../../scripts/deployment/environment.mjs';

const seedFor=()=>loadInstallerSeed(process.cwd(),commandAdapter);
const owner={target:'local',EMAIL_PROVIDER:'later',OWNER_EMAIL:'owner@example.test',OWNER_PASSWORD:randomBytes(18).toString('base64url'),WIDGET_ORIGIN:'https://example.test'};
const quiet={step:async()=>{},addSecrets(){}};
const withRoot=async action=>{const root=await mkdtemp(join(tmpdir(),'h2h-setup-answers-'));try{return await action(root);}finally{await rm(root,{recursive:true,force:true});}};
const settings=(root,input,manifest)=>prepareSettings({root,store:quiet,input,manifest,selectedOrigin:'http://127.0.0.1:47291'},adapter.hooks);

test('native local preparation selects development suppression and refuses to replace a saved remote provider',async()=>{
 const root=await mkdtemp(join(tmpdir(),'h2h-local-mail-'));
 try{
  const path=join(root,'.dev.vars');
  await writeFile(path,'OWNER_SETTING="retained"\n',{mode:0o600});
  const context={root,input:{EMAIL_PROVIDER:'later'}};await prepareNativeLocal(context);
  assert.equal(context.input.EMAIL_PROVIDER,'development');
  const remoteKey=randomBytes(24).toString('hex');const retained='EMAIL_PROVIDER="sendgrid"\nEMAIL_API_KEY="'+remoteKey+'"\nOWNER_SETTING="retained"\n';await writeFile(path,retained,{mode:0o600});
  await assert.rejects(prepareNativeLocal({root,input:{EMAIL_PROVIDER:'later'}}),/saved mail provider/);
  assert.equal(await readFile(path,'utf8'),retained,'native adapter refuses a remote selection without replacing it');
  assert.throws(()=>validateRuntimeEnvironment({H2H_LOCAL:'true',EMAIL_PROVIDER:'development'}),/cannot be deployed/);
  assert.throws(()=>validateRuntimeEnvironment({EMAIL_PROVIDER:'development'}),/must be resend/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('setup needs no workspace name, colour or owner name, and the optional answers are not invented',async()=>{
 const {model}=await seedFor();
 const input=model.validateInput(owner);
 for(const name of ['WORKSPACE_NAME','PRIMARY_COLOR'])assert.ok(!input[name],name);
 assert.ok(!input.OWNER_NAME,'Base fills the declared empty default, never a made-up name');
 assert.throws(()=>model.validateInput({...owner,WIDGET_ORIGIN:''}),/Provide required setup inputs/);
 assert.throws(()=>model.validateInput({...owner,OWNER_PASSWORD:''}),/Provide required setup inputs/);
 assert.doesNotMatch(readySummary({target:'local'}),/undefined/);
 assert.doesNotMatch(readySummary({target:'remote',OWNER_EMAIL:owner.OWNER_EMAIL}),/undefined/);
});

test('the owner request carries only the answers that exist',async()=>{
 const sent=[];const real=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  if(init?.method!=='POST')return Response.json({available:true});
  sent.push(JSON.parse(init.body));return Response.json({token:'session',userId:'u',projectId:'p'},{status:201});
 };
 try{
  const run=input=>nativeOwner({origin:'http://127.0.0.1:47291',input,vars:{H2H_SETUP_TOKEN:'setup-token'},store:quiet,fail:()=>Error('setup')});
  await run({...owner,WORKSPACE_NAME:undefined,OWNER_NAME:'',PRIMARY_COLOR:undefined});
  await run({...owner,WORKSPACE_NAME:'Named',OWNER_NAME:'Pat',PRIMARY_COLOR:'#123456'});
 }finally{globalThis.fetch=real;}
 assert.deepEqual(Object.keys(sent[0]).sort(),['allowedOrigin','email','password','setupToken']);
 assert.deepEqual([sent[1].name,sent[1].ownerName,sent[1].primaryColor],['Named','Pat','#123456']);
});

test('a chosen AI service lands only in its own installation secret',async()=>withRoot(async root=>{
 const {model,manifest}=await seedFor();
 const key=randomBytes(24).toString('hex');
 assert.throws(()=>model.validateInput({...owner,AI_PROVIDER:'openai'}),/Provide required setup inputs/);
 const input=model.validateInput({...owner,AI_PROVIDER:'openai',OPENAI_API_KEY:key});
 const context={root,input,manifest,store:quiet};await prepareNativeLocal(context);await settings(root,input,manifest);
 const saved=await readFile(join(root,'.dev.vars'),'utf8');
 assert.match(saved,new RegExp('^OPENAI_API_KEY='+key+'$','m'));
 assert.doesNotMatch(saved,/^(?:ANTHROPIC|GOOGLE|GEMINI|DEEPSEEK|XAI|OPENROUTER)_API_KEY=/m);
 assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
 // An answer for another service is contradictory and is refused before anything is written.
 await rm(join(root,'.dev.vars'));
 const other=randomBytes(24).toString('hex');
 await assert.rejects(prepareNativeLocal({root,manifest,store:quiet,input:{...owner,AI_PROVIDER:'later',ANTHROPIC_API_KEY:other}}),error=>/ANTHROPIC_API_KEY/.test(error.message)&&!error.message.includes(other));
 await assert.rejects(stat(join(root,'.dev.vars')),{code:'ENOENT'});
}));

test('a fresh checkout gets a generated inbound token once and an older checkout gains it without other changes',async()=>withRoot(async root=>{
 const {model,manifest}=await seedFor();
 const input=model.validateInput(owner);const hex=/^INBOUND_EMAIL_TOKEN=([0-9a-f]{64})$/m;
 const context=()=>({root,input,manifest,store:quiet});
 await prepareNativeLocal(context());
 await assert.rejects(stat(join(root,'.dev.vars')),{code:'ENOENT'},'preparation does not create settings; the secrets phase does');
 await settings(root,input,manifest);
 const fresh=await readFile(join(root,'.dev.vars'),'utf8');
 assert.match(fresh,hex);
 await prepareNativeLocal(context());await settings(root,input,manifest);
 assert.equal(await readFile(join(root,'.dev.vars'),'utf8'),fresh,'a rerun rotates nothing');
 // A checkout set up before the token existed: only the missing token is appended.
 const older=fresh.replace(/^INBOUND_EMAIL_TOKEN=.*\n/m,'');
 assert.doesNotMatch(older,/INBOUND_EMAIL_TOKEN/);
 await writeFile(join(root,'.dev.vars'),older,{mode:0o600});
 const secrets=[];
 await prepareNativeLocal({...context(),store:{...quiet,addSecrets:values=>secrets.push(...values)}});
 const upgraded=await readFile(join(root,'.dev.vars'),'utf8');
 assert.ok(upgraded.startsWith(older),'existing settings and secrets are byte-identical');
 const token=upgraded.slice(older.length).match(hex)?.[1];
 assert.ok(token&&upgraded.slice(older.length)===`INBOUND_EMAIL_TOKEN=${token}\n`,'one appended line');
 assert.deepEqual(secrets,[token],'the new value is registered for redaction');
 assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
 await prepareNativeLocal(context());
 assert.equal(await readFile(join(root,'.dev.vars'),'utf8'),upgraded,'the added token is not rotated');
 // A refusal leaves the older file exactly as it was.
 await writeFile(join(root,'.dev.vars'),older+'EMAIL_PROVIDER="resend"\n',{mode:0o600});
 await assert.rejects(prepareNativeLocal(context()),/saved mail provider/);
 assert.doesNotMatch(await readFile(join(root,'.dev.vars'),'utf8'),/INBOUND_EMAIL_TOKEN/);
}));

test('the inbound mailbox domain is an optional runtime variable that must be a domain name',()=>{
 assert.equal(runtimeVariables({INBOUND_EMAIL_DOMAIN:'in.example.com'}).INBOUND_EMAIL_DOMAIN,'in.example.com');
 assert.deepEqual(runtimeVariables({INBOUND_EMAIL_DOMAIN:''}),{});
 validateRuntimeEnvironment({INBOUND_EMAIL_DOMAIN:'in.example.com'});validateRuntimeEnvironment({});
 for(const bad of ['https://in.example.com','in.example.com/path','user@example.com','localhost'])assert.throws(()=>validateRuntimeEnvironment({INBOUND_EMAIL_DOMAIN:bad}),/INBOUND_EMAIL_DOMAIN/);
});
