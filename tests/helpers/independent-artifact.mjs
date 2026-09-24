import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function artifactRuntime(artifact,{directory,port=12401,variables={},restoreFile}={}) {
 directory??=await mkdtemp(join(tmpdir(),'h2h-independent-'));
 for(const module of artifact.modules){const path=join(directory,'server',module.name);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(module.contentBase64,'base64'));}
 for(const asset of artifact.assets){const path=join(directory,'public',asset.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(asset.contentBase64,'base64'));}
 const spec=artifact.deploymentSpec,secret=randomUUID(),migrations=join(directory,'migrations');await mkdir(migrations,{recursive:true});
 for(const migration of spec.migrations)await writeFile(join(migrations,migration.name),migration.sql);
 // Test-only privileged inspection is never part of the emitted application.
 await writeFile(join(directory,'server','test-entry.js'),`import app from './${artifact.mainModule}';export * from './${artifact.mainModule}';export default {...app,async fetch(request,env,ctx){if(request.headers.get('X-Test-Key')===${JSON.stringify(secret)}){const b=await request.json();if(b.sql)return Response.json(await env.DB.prepare(b.sql).bind(...(b.values||[])).all());if(b.list)return Response.json(await env.FILES.list(b.list));if(b.key){if(b.bytes)await env.FILES.put(b.key,Uint8Array.from(b.bytes),b.options);const o=await env.FILES.get(b.key);return Response.json(o?{key:o.key,bytes:Array.from(new Uint8Array(await o.arrayBuffer())),httpMetadata:o.httpMetadata,customMetadata:o.customMetadata}:null);}}return app.fetch(request,env,ctx)}};`);
 const config={name:'h2h-independent-test',main:'server/test-entry.js',no_bundle:true,rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}],compatibility_date:spec.compatibilityDate,compatibility_flags:spec.compatibilityFlags,assets:{directory:'public'},d1_databases:[{binding:'DB',database_name:'independent-db',database_id:'independent-local-only',migrations_dir:'migrations'}],r2_buckets:[{binding:'FILES',bucket_name:'independent-files'}],durable_objects:{bindings:spec.durableObjects.map(x=>({name:x.binding,class_name:x.className}))},migrations:spec.durableObjectMigrations.map(x=>({tag:x.tag,new_sqlite_classes:x.newSqliteClasses})),queues:{producers:[{binding:'JOBS',queue:'independent-jobs'},{binding:'JOBS_DEAD_LETTER',queue:'independent-dead'}]},vars:{...spec.publicVariables,...variables}};
 await writeFile(join(directory,'wrangler.json'),JSON.stringify(config));
 const wrangler=resolve('node_modules/wrangler/bin/wrangler.js'),env={PATH:process.env.PATH,CI:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'};let logs='';
 const run=args=>new Promise((done,reject)=>{const p=spawn(process.execPath,[wrangler,...args],{cwd:directory,env,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>logs+=b);p.stderr.on('data',b=>logs+=b);p.on('error',reject);p.on('exit',code=>code===0?done():reject(new Error(logs)))});
 if(restoreFile)await run(['d1','execute','DB','--local','--persist-to','.wrangler/state','--file',restoreFile]);else await run(['d1','migrations','apply','DB','--local','--persist-to','.wrangler/state']);
 const child=spawn(process.execPath,[wrangler,'dev','--local','--port',String(port),'--ip','127.0.0.1','--persist-to','.wrangler/state'],{cwd:directory,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>{logs+=b;process.stderr.write(b)});child.stderr.on('data',b=>{logs+=b;process.stderr.write(b)});
 const origin=`http://127.0.0.1:${port}`;
 const close=async()=>{child.kill('SIGTERM');await Promise.race([new Promise(r=>child.exitCode!==null?r():child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)child.kill('SIGKILL');await writeFile(join(directory,'runtime.log'),logs)};
 for(let i=0;i<160;i++){try{if((await fetch(origin+'/health')).ok)break}catch{}if(child.exitCode!==null||i===159){await close();throw new Error(logs)}await new Promise(r=>setTimeout(r,250))}
 const inspect=async body=>{const response=await fetch(origin+'/__test',{method:'POST',headers:{'X-Test-Key':secret,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw Error(await response.text());return response.json()};
 return {origin,directory,close,inspect,run};
}
