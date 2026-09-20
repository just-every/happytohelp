import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, chmod, stat, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = await realpath(await mkdtemp(join(tmpdir(), 'h2h-private-deploy-')));
try {
 for (const path of ['scripts/deployment', 'scripts/base-onboarding', 'src/modules', 'migrations', '.seed/deployment/private-test']) await mkdir(join(root, path), {recursive:true});
 for (const file of ['scripts/migrations.mjs', 'scripts/deployment/config.mjs', 'scripts/deployment/domains.mjs', 'scripts/base-onboarding/wrangler-auth.mjs', 'scripts/deployment/provision.mjs', 'scripts/deployment/run.mjs', 'scripts/deployment/environment.mjs', 'scripts/base-onboarding/private-files.mjs']) await cp(new URL('../'+file,import.meta.url),join(root,file));
 const declared=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 await writeFile(join(root,'wrangler.jsonc'),JSON.stringify({...declared,vars:{OWNER_SETTING:'preserved'},env:{legacy:{}}}));
 const path=join(root,'.seed/deployment/private-test/wrangler.json');
 await writeFile(path,'old config');await chmod(path,0o666);
 for(const directory of ['.seed','.seed/deployment','.seed/deployment/private-test'])await chmod(join(root,directory),0o777);
 const {prepareRemote}=await import(pathToFileURL(join(root,'scripts/deployment/config.mjs')));
 const databaseId='11111111-1111-4111-8111-111111111111';let calls=0;
 const execute=async args=>{
  calls++;
  assert.deepEqual(args.slice(0,2),['exec','wrangler']);
  const command=args.slice(2).join(' ');
  if(command==='d1 list --json')return {stdout:JSON.stringify([{name:'private-test-db',uuid:databaseId}])};
  if(command==='r2 bucket list')return {stdout:'name: private-test-files'};
  if(command==='queues list')return {stdout:'| private-test-jobs |\n| private-test-jobs-dead |'};
  throw Error('Unexpected provider fixture command: '+command);
 };
 const result=await prepareRemote({CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),H2H_RESOURCE_PREFIX:'private-test',H2H_PUBLIC_ORIGIN:'https://private-test.owner.workers.dev',H2H_SETUP_TOKEN:'test-only-secret',OPENAI_API_KEY:'test-only-api-key',H2H_SETUP_OWNER_EMAIL:'owner@example.test'},execute);
 assert.equal(calls,3);assert.equal(result.path,path);
 assert.equal((await stat(path)).mode&0o777,0o600);
 for(const directory of ['.seed','.seed/deployment','.seed/deployment/private-test'])assert.equal((await stat(join(root,directory))).mode&0o777,0o700);
 const config=JSON.parse(await readFile(path,'utf8'));
 assert.deepEqual(config.vars,{OWNER_SETTING:'preserved',H2H_SETUP_OWNER_EMAIL:'owner@example.test',APP_ORIGIN:'https://private-test.owner.workers.dev'});
 assert.equal(config.d1_databases[0].database_id,databaseId);assert.equal(config.env,undefined);
 assert.equal(config.name,'private-test');assert.equal(config.workers_dev,true);
 assert.deepEqual(config.queues,{...declared.queues,producers:[{binding:'JOBS',queue:'private-test-jobs'},{binding:'JOBS_DEAD_LETTER',queue:'private-test-jobs-dead'}],consumers:declared.queues.consumers.map(consumer=>({...consumer,queue:'private-test-jobs',dead_letter_queue:'private-test-jobs-dead'}))});
 console.log('Deployment config permissions passed: existing file/directories tightened, owner variables preserved, runtime secrets excluded. No provider calls.');
 const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),H2H_RESOURCE_PREFIX:'private-test',H2H_PUBLIC_ORIGIN:'https://app.example.test',CLOUDFLARE_API_TOKEN:'test-only-token'};
 const zone={id:'b'.repeat(32),name:'example.test',account:{id:env.CLOUDFLARE_ACCOUNT_ID},status:'active'};
 for(const response of [()=>new Response('{}',{status:403}),()=>Response.json({success:true,result:[]}),()=>Response.json({success:true,result:[{...zone,status:'pending',name:'app.example.test'}]}),()=>Response.json({success:true,result:[{...zone,name:'app.example.test',account:{id:'c'.repeat(32)}}]})]){
  let mutations=0;
  await assert.rejects(prepareRemote(env,async()=>{mutations++;throw Error('Must not provision');},{fetch:async()=>response()}),/Cloudflare|Custom domain/);
  assert.equal(mutations,0);
 }
 const requested=[];
 const fetch=async(url,options)=>{
  const query=new URL(url);assert.equal(query.origin,'https://api.cloudflare.com');assert.equal(query.searchParams.get('account.id'),env.CLOUDFLARE_ACCOUNT_ID);
  assert.equal(options.headers.Authorization,'Bearer test-only-token');assert.equal(options.redirect,'error');
  const name=query.searchParams.get('name');requested.push(name);
  return Response.json({success:true,result:name==='example.test'?[zone]:[]});
 };
 calls=0;const custom=await prepareRemote({...env,PREVIEW_ORIGIN:'https://preview.example.test'},execute,{fetch});
 assert.equal(calls,3);assert.deepEqual(requested,['app.example.test','example.test','preview.example.test','example.test']);
 assert.deepEqual(JSON.parse(await readFile(custom.path,'utf8')).routes,[{pattern:'app.example.test',custom_domain:true,zone_id:zone.id},{pattern:'preview.example.test',custom_domain:true,zone_id:zone.id}]);
 const {customDomainRoutes}=await import(pathToFileURL(join(root,'scripts/deployment/domains.mjs')));
 for(const credential of [{type:'oauth',token:'oauth-test'},{type:'api_key',key:'key-test',email:'owner@example.test'}]){
  let authCalls=0;
  await customDomainRoutes(root,env.CLOUDFLARE_ACCOUNT_ID,['example.test'],{},async(args)=>{assert.deepEqual(args,['exec','wrangler','auth','token','--json']);authCalls++;return{stdout:JSON.stringify(credential)};},async(url,options)=>{
   assert.deepEqual(options.headers,credential.type==='oauth'?{Authorization:'Bearer oauth-test'}:{'X-Auth-Key':'key-test','X-Auth-Email':'owner@example.test'});
   return Response.json({success:true,result:[zone]});
  });assert.equal(authCalls,1);
 }
 console.log('Deployment topology/domain preflight passed: both queue producers preserved; custom main/preview active zones checked before mutations; unavailable, unowned, inactive and unauthorized domains refused; OAuth/API-key semantics retained. No provider calls.');
} finally { await rm(root,{recursive:true,force:true}); }
