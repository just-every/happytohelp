import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {artifactRuntime} from './helpers/independent-artifact.mjs';
import {verifyStreamedRejection} from './helpers/streamed-rejection.mjs';
const artifact=JSON.parse(await readFile('delivery-artifact/happytohelp-worker-artifact.json'));
const evidence=process.env.H2H_EVIDENCE_DIR||await mkdtemp(join(tmpdir(),'h2h-independent-proof-'));
const setupToken='local-test-only-installation-credential';
const runtime=await artifactRuntime(artifact,{variables:{H2H_SETUP_TOKEN:setupToken}});let restored;
const call=async(r,path,body,token,method=body===undefined?'GET':'POST',headers={})=>fetch(r.origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const body={name:'Independent owner workspace',email:'independent@example.test',password:'independent-password-2026',allowedOrigin:'https://website.example'};
async function snapshot(r){const tables=(await r.inspect({sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name"})).results;const result={};for(const {name}of tables){result[name]=(await r.inspect({sql:`SELECT * FROM "${name.replaceAll('"','""')}"`})).results.map(row=>JSON.stringify(row)).sort()}return result}
try{
 console.log('runtime ready',runtime.directory);
 await assert.rejects(runtime.withStorage(()=>{}),/Stop the application/);
 assert.equal((await call(runtime,'/api/identity/setup-status')).status,409);
 assert.equal((await call(runtime,'/api/identity/bootstrap',body)).status,403);
 assert.equal((await call(runtime,'/api/identity/bootstrap',{...body,setupToken:'wrong'})).status,403);
 console.log('token refusal passed');const setup=await call(runtime,'/api/identity/bootstrap',{...body,setupToken});assert.equal(setup.status,201);const owner=await setup.json();
 assert.equal((await call(runtime,'/api/identity/setup-status')).status,200);
 assert.equal((await call(runtime,'/api/identity/bootstrap',{...body,setupToken})).status,409);
 const project=await(await call(runtime,`/api/identity/projects/${owner.projectId}`,undefined,owner.token)).json();
 assert.equal((await call(runtime,'/api/identity/widget/session',{widgetKey:project.widget_key},undefined,'POST',{Origin:'https://foreign.example'})).status,403);
 const widget=await(await call(runtime,'/api/identity/widget/session',{widgetKey:project.widget_key},undefined,'POST',{Origin:body.allowedOrigin})).json();
 const conversation=await(await call(runtime,'/api/conversations',{projectId:owner.projectId},widget.token)).json();
 const command={localId:'independent-durable-message',content:'Persist this owner conversation through export and restore.',expectedRevision:0};
 assert.equal((await call(runtime,`/api/conversations/${conversation.id}/messages`,command,widget.token)).status,200);
 assert.equal((await(await call(runtime,`/api/conversations/${conversation.id}/messages`,command,widget.token)).json()).duplicate,true);
 assert.equal((await call(runtime,`/api/conversations/${conversation.id}/messages`)).status,401);
 const article=await call(runtime,`/api/knowledge/${owner.projectId}/articles`,{title:'Independent knowledge',slug:'independent-knowledge',content:'This knowledge remains owner controlled.',status:'published'},owner.token);assert.equal(article.status,201,await article.clone().text());
 const preview=await call(runtime,`/api/site-preview/projects/${owner.projectId}/preview`,{url:body.allowedOrigin},owner.token);assert.equal(preview.status,503); // No separate mapped origin in this standalone local target.
 await verifyStreamedRejection(runtime.origin+`/api/site-preview/projects/${owner.projectId}/preview`,owner.token,{url:body.allowedOrigin},503);
 const object={key:`${owner.projectId}/retained/object.bin`,bytes:[0,1,2,255,128,42],options:{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{owner:'independent'}}};
 // Exercise the emitted application's real authenticated media path before
 // native backup. Storage inspection never replaces this application check.
 const upload=await fetch(runtime.origin+`/api/conversations/${conversation.id}/media`,{method:'POST',headers:{Authorization:`Bearer ${owner.token}`,'Content-Type':'application/octet-stream','X-Filename':'retained.bin'},body:Uint8Array.from(object.bytes)});
 assert.equal(upload.status,201,await upload.clone().text());const media=await upload.json();
 const download=async r=>{const response=await call(r,`/api/conversations/${conversation.id}/media/${media.id}`,undefined,owner.token);assert.equal(response.status,200);assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())),object.bytes);};
 await download(runtime);
 await runtime.close();
 console.log('journey and real application R2 upload/download passed');let before;const objects=[];
 await runtime.withStorage(async storage=>{
  await assert.rejects(runtime.start(),/Close native storage/);
  await storage.inspect(object);
  // Exact schema guard: 97 tables. Migration 0102_public_abuse_limits adds
  // abuse_counters and 0103_contact_erasure adds contact_erasures and
  // contact_erasure_objects to the previous 94.
  before=await snapshot(storage);assert.equal(Object.keys(before).length,97);
  let cursor;do{const page=await storage.inspect({list:{...(cursor?{cursor}:{})}});for(const o of page.objects)objects.push(await storage.inspect({key:o.key}));cursor=page.truncated?page.cursor:undefined}while(cursor);
  assert.deepEqual(objects.find(o=>o.key===object.key),{key:object.key,bytes:object.bytes,httpMetadata:object.options.httpMetadata,customMetadata:object.options.customMetadata});
  const uploaded=(await storage.inspect({sql:'SELECT object_key FROM media WHERE id=?',values:[media.id]})).results[0];
  assert.deepEqual(objects.find(o=>o.key===uploaded.object_key).bytes,object.bytes);
 });
 const sqlFile=join(evidence,'native-export.sql');await runtime.run(['d1','export','DB','--local','--output',sqlFile]);
 restored=await artifactRuntime(artifact,{port:12501,restoreFile:sqlFile,variables:{H2H_SETUP_TOKEN:setupToken},start:false});
 await restored.withStorage(async storage=>{
  for(const o of objects)await storage.inspect({key:o.key,bytes:o.bytes,options:{httpMetadata:o.httpMetadata,customMetadata:o.customMetadata}});
  assert.deepEqual(await snapshot(storage),before);
  for(const o of objects)assert.deepEqual(await storage.inspect({key:o.key}),o);
 });
 const repeatExport=join(evidence,'restored-export.sql');await restored.run(['d1','export','DB','--local','--output',repeatExport]);
 assert.equal(await readFile(repeatExport,'utf8'),await readFile(sqlFile,'utf8'));
 await restored.start();await download(restored);
 const transcript=await(await call(restored,`/api/conversations/${conversation.id}/messages`,undefined,owner.token)).json();assert.equal(transcript.messages[0].content,command.content);
 assert.equal((await call(restored,'/api/identity/bootstrap',{...body,setupToken})).status,409);
 const login=await call(restored,'/api/identity/login',{email:body.email,password:body.password});assert.equal(login.status,200);const signedIn=await login.json();assert.equal((await call(restored,'/api/identity/session',undefined,signedIn.token)).status,200);

 // Login creates another valid session after exact SQL re-export equality.
 const receipt={artifactSha256:createHash('sha256').update(await readFile('delivery-artifact/happytohelp-worker-artifact.json')).digest('hex'),migrations:artifact.deploymentSpec.migrations.length,tables:Object.keys(before).length,objects:objects.map(o=>({key:o.key,sha256:createHash('sha256').update(Buffer.from(o.bytes)).digest('hex')})),sourceRuntime:runtime.directory,restoredRuntime:restored.directory,evidence,providerCalls:0,completeRerExport:false,checks:['token missing/wrong denial','atomic owner setup closed','widget origin denial','durable duplicate-safe conversation','published knowledge','separate-preview-origin required','early preview rejection finishes streamed request before authenticated media upload','native D1 export/fresh import','all table equality before intentional login','R2 byte and metadata equality','real application authenticated media upload and retained-session download before and after restore','retained session and fresh password login','restored setup refusal']};
 await writeFile(join(evidence,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await runtime.close();if(restored)await restored.close()}
