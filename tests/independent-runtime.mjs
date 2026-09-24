import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {artifactRuntime} from './helpers/independent-artifact.mjs';
const artifact=JSON.parse(await readFile('delivery-artifact/happytohelp-worker-artifact.json'));
const evidence=process.env.H2H_EVIDENCE_DIR||await mkdtemp(join(tmpdir(),'h2h-independent-proof-'));
const setupToken='local-test-only-installation-credential';
const runtime=await artifactRuntime(artifact,{variables:{H2H_SETUP_TOKEN:setupToken}});let restored;
const call=async(r,path,body,token,method=body===undefined?'GET':'POST',headers={})=>fetch(r.origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const body={name:'Independent owner workspace',email:'independent@example.test',password:'independent-password-2026',allowedOrigin:'https://website.example'};
async function snapshot(r){const tables=(await r.inspect({sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name"})).results;const result={};for(const {name}of tables){result[name]=(await r.inspect({sql:`SELECT * FROM "${name.replaceAll('"','""')}"`})).results.map(row=>JSON.stringify(row)).sort()}return result}
try{
 console.log('runtime ready',runtime.directory);
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
 const object={key:`${owner.projectId}/retained/object.bin`,bytes:[0,1,2,255,128,42],options:{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{owner:'independent'}}};
 await runtime.inspect(object);
 console.log('journey passed');const before=await snapshot(runtime);
 const objects=[];let cursor;do{const page=await runtime.inspect({list:{...(cursor?{cursor}:{})}});for(const o of page.objects)objects.push(await runtime.inspect({key:o.key}));cursor=page.truncated?page.cursor:undefined}while(cursor);
 const sqlFile=join(evidence,'native-export.sql');await runtime.run(['d1','export','DB','--local','--output',sqlFile]);
 await runtime.close();
 restored=await artifactRuntime(artifact,{port:12501,restoreFile:sqlFile,variables:{H2H_SETUP_TOKEN:setupToken}});
 for(const o of objects)await restored.inspect({key:o.key,bytes:o.bytes,options:{httpMetadata:o.httpMetadata,customMetadata:o.customMetadata}});
 assert.deepEqual(await snapshot(restored),before);
 for(const o of objects)assert.deepEqual(await restored.inspect({key:o.key}),o);
 const repeatExport=join(evidence,'restored-export.sql');await restored.run(['d1','export','DB','--local','--output',repeatExport]);
 assert.equal(await readFile(repeatExport,'utf8'),await readFile(sqlFile,'utf8'));
 const transcript=await(await call(restored,`/api/conversations/${conversation.id}/messages`,undefined,owner.token)).json();assert.equal(transcript.messages[0].content,command.content);
 assert.equal((await call(restored,'/api/identity/bootstrap',{...body,setupToken})).status,409);
 const login=await call(restored,'/api/identity/login',{email:body.email,password:body.password});assert.equal(login.status,200);

 // Login creates another valid session after exact SQL re-export equality.
 const receipt={artifactSha256:createHash('sha256').update(await readFile('delivery-artifact/happytohelp-worker-artifact.json')).digest('hex'),migrations:artifact.deploymentSpec.migrations.length,tables:Object.keys(before).length,objects:objects.map(o=>({key:o.key,sha256:createHash('sha256').update(Buffer.from(o.bytes)).digest('hex')})),sourceRuntime:runtime.directory,restoredRuntime:restored.directory,evidence,providerCalls:0,completeRerExport:false,checks:['token missing/wrong denial','atomic owner setup closed','widget origin denial','durable duplicate-safe conversation','published knowledge','separate-preview-origin required','native D1 export/fresh import','all table equality before intentional login','R2 byte and metadata equality','retained session and fresh password login','restored setup refusal']};
 await writeFile(join(evidence,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await runtime.close();if(restored)await restored.close()}
