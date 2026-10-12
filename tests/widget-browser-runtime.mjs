import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createLocalMailRuntime} from './helpers/local-mail-runtime.mjs';
const runtime=await createLocalMailRuntime();let success=false;
const evidenceRoot=process.env.H2H_EVIDENCE_DIR?resolve(process.env.H2H_EVIDENCE_DIR):await mkdtemp(join(tmpdir(),'h2h-widget-evidence-'));const proofDir=pathToFileURL(join(evidenceRoot,'widget-native')+'/');await mkdir(proofDir,{recursive:true});console.log('Widget evidence:',proofDir.pathname);
const call=async(path,body,token,extra={})=>{const response=await fetch(runtime.origin+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(response.ok,`${path}: ${response.status} ${await response.clone().text()}`);return response.json()};
try{
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));const origin=`http://127.0.0.1:${port}`;
 const owner=await call('/api/identity/bootstrap',{password:'test-setup-password-123',name:'Widget runtime proof',email:'widget-runtime@example.test',allowedOrigin:origin});
 const project=await call(`/api/identity/projects/${owner.projectId}`,undefined,owner.token);
 const foreignOwner=await runtime.seedTenant({name:'Other tenant',email:'foreign-widget@example.test',allowedOrigin:origin});
 const foreignProject=await call(`/api/identity/projects/${foreignOwner.projectId}`,undefined,foreignOwner.token);
 const foreignContact=await call('/api/identity/widget/session',{widgetKey:foreignProject.widget_key},undefined,{Origin:origin});
 const foreignConversation=await call('/api/conversations',{projectId:foreignOwner.projectId},foreignContact.token);
 const env={...process.env,WIDGET_TEST_API:runtime.origin,WIDGET_TEST_ORIGIN:origin,WIDGET_TEST_KEY:project.widget_key,WIDGET_TEST_OWNER_TOKEN:owner.token,WIDGET_TEST_FOREIGN_CONVERSATION:foreignConversation.id,WIDGET_TEST_EVIDENCE_DIR:proofDir.pathname,PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||process.env.H2H_PLAYWRIGHT_MODULE||'playwright'};
 const results=[];
 for(const file of ['widget-browser.mjs','widget-native-lost-response.mjs'])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[new URL(file,import.meta.url).pathname],{env,stdio:['ignore','pipe','pipe']});const deadline=setTimeout(()=>child.kill('SIGTERM'),120000);let output='';child.stdout.on('data',data=>{output+=data;process.stdout.write(data)});child.stderr.on('data',data=>{output+=data;process.stderr.write(data)});child.on('error',reject);child.on('exit',async code=>{clearTimeout(deadline);await writeFile(new URL(file+'.log',proofDir),output);results.push({file,code});code===0?resolve():reject(new Error(`${file} exited ${code}`))})});
 const hash=async path=>createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');
 await writeFile(new URL('runtime.json',proofDir),JSON.stringify({runtime:'isolated emitted Worker, real D1/R2/DO; no provider credentials',migrationCount:runtime.migrationCount,widgetSha256:await hash('../public/widget.js'),workerSha256:await hash('../dist/server/index.js'),results},null,2));success=true;
}finally{await runtime.close(success)}
