import {payloadBytes} from './artifact-payloads.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {withArtifactStorage} from './independent-storage.mjs';

export async function artifactRuntime(artifact,{directory,port=12401,variables={},restoreFile,start=true}={}) {
 directory??=await mkdtemp(join(tmpdir(),'h2h-independent-'));
 for(const module of artifact.modules){const path=join(directory,'server',module.name);await mkdir(dirname(path),{recursive:true});await writeFile(path,await payloadBytes(artifact,module));}
 for(const asset of artifact.assets){const path=join(directory,'public',asset.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,await payloadBytes(artifact,asset));}
 const spec=artifact.deploymentSpec,migrations=join(directory,'migrations');await mkdir(migrations,{recursive:true});
 for(const migration of spec.migrations)await writeFile(join(migrations,migration.name),migration.sql);
 const config={name:'h2h-independent-test',main:'server/'+artifact.mainModule,no_bundle:true,rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}],compatibility_date:spec.compatibilityDate,compatibility_flags:spec.compatibilityFlags,assets:{directory:'public'},d1_databases:[{binding:'DB',database_name:'independent-db',database_id:'independent-local-only',migrations_dir:'migrations'}],r2_buckets:[{binding:'FILES',bucket_name:'independent-files'}],durable_objects:{bindings:spec.durableObjects.map(x=>({name:x.binding,class_name:x.className}))},migrations:spec.durableObjectMigrations.map(x=>({tag:x.tag,new_sqlite_classes:x.newSqliteClasses})),queues:{producers:[{binding:'JOBS',queue:'independent-jobs'},{binding:'JOBS_DEAD_LETTER',queue:'independent-dead'}]},vars:{...spec.publicVariables,...variables}};
 await writeFile(join(directory,'wrangler.json'),JSON.stringify(config));
 const wrangler=resolve('node_modules/wrangler/bin/wrangler.js'),env={PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,WRANGLER_LOG_PATH:process.env.WRANGLER_LOG_PATH,CI:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'};let logs='';
 const run=args=>new Promise((done,reject)=>{const p=spawn(process.execPath,[wrangler,...args],{cwd:directory,env,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>logs+=b);p.stderr.on('data',b=>logs+=b);p.on('error',reject);p.on('exit',code=>code===0?done():reject(new Error(logs)))});
 if(restoreFile)await run(['d1','execute','DB','--local','--persist-to','.wrangler/state','--file',restoreFile]);else await run(['d1','migrations','apply','DB','--local','--persist-to','.wrangler/state']);
 let child;let storageOpen=false;
 const origin=`http://127.0.0.1:${port}`;
 const close=async()=>{
  if(child&&child.exitCode===null&&child.signalCode===null){
   const exited=new Promise(resolve=>child.once('exit',resolve));
   child.kill('SIGTERM');let timer;
   await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(resolve,3000)})]);clearTimeout(timer);
   if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
  }
  await writeFile(join(directory,'runtime.log'),logs);
 };
 const startRuntime=async()=>{
  if(storageOpen)throw new Error('Close native storage before starting the application');
  if(child&&child.exitCode===null&&child.signalCode===null)throw new Error('Artifact runtime is already running');
  child=spawn(process.execPath,[wrangler,'dev','--local','--port',String(port),'--ip','127.0.0.1','--persist-to','.wrangler/state'],{cwd:directory,env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>{logs+=b;process.stderr.write(b)});child.stderr.on('data',b=>{logs+=b;process.stderr.write(b)});
  for(let i=0;i<160;i++){
   try{const response=await fetch(origin+'/health');const health=await response.json();if(response.ok&&health.database==='reachable'&&health.files==='reachable')return;}catch{}
   if(child.exitCode!==null||child.signalCode!==null||i===159){await close();throw new Error(logs);}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
 };
 const withStorage=async visit=>{
  if(child&&child.exitCode===null&&child.signalCode===null)throw new Error('Stop the application before opening native storage');
  if(storageOpen)throw new Error('Native storage is already open');
  storageOpen=true;
  try{return await withArtifactStorage(directory,config,visit);}finally{storageOpen=false;}
 };
 if(start)await startRuntime();
 return {origin,directory,close,start:startRuntime,withStorage,run};
}
