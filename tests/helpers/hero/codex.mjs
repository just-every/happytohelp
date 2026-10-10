#!/usr/bin/env node
// Test-only Codex app-server boundary. Native connector, pairing, Worker, D1,
// publication and sockets are real. No provider network or production data.
import {createInterface} from 'node:readline';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(process.argv[2]==='--version'){console.log('test-boundary 1');process.exit(0)}
if(process.argv[2]==='login'){console.log('Logged in (test provider boundary)');process.exit(0)}
assert.equal(process.argv[2],'app-server');
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const threadId='test-provider-thread';
for await(const line of createInterface({input:process.stdin})){
 const message=JSON.parse(line);if(message.id===undefined)continue;
 try{
  if(message.method==='initialize')send({id:message.id,result:{userAgent:'test-only'}});
  else if(message.method==='thread/start')send({id:message.id,result:{thread:{id:threadId}}});
  else if(message.method==='turn/start'){
   const prompt=message.params.input[0].text;assert.match(prompt,/resolve/);assert.match(prompt,/contact-your-support-team/);
   const task=JSON.parse(await readFile(message.params.cwd+'/article-access.json'));
   const headers={Authorization:'Bearer '+task.token};
   const article=await fetch(task.base+'/article',{headers});assert.equal(article.status,200);const before=await article.json();
   assert.equal((await fetch(task.publicApiUrl)).status,404);
   const published=await fetch(task.base+'/publish',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({articleId:before.article.id})});assert.equal(published.status,201);
   const after=await fetch(task.publicApiUrl);assert.equal(after.status,200);assert.equal((await after.json()).content,before.article.content);
   const page=await fetch(task.publicUrl);assert.equal(page.status,200);assert.ok((await page.text()).includes(before.article.title));
   const output={status:'completed',summary:'Published the missing contact guide.',actions:[{description:'Published the existing native article unchanged',evidence:`Public API before HTTP 404; native publication HTTP 201; public API and page after HTTP 200: ${task.publicUrl}`}],verified:true,question:null,reply_draft:'',replies:[{id:'publication_reply',title:'Published contact guide',body:`The contact guide is now available at ${task.publicUrl}. You can follow it to contact your support team.`}],follow_up_actions:[]};
   await writeFile(message.params.cwd+'/provider-receipt.json',JSON.stringify({before:404,publication:201,after:200,output}));
   send({id:message.id,result:{turn:{id:'test-turn'}}});
   send({method:'item/completed',params:{threadId,item:{type:'agentMessage',text:JSON.stringify(output)}}});
   send({method:'turn/completed',params:{threadId,turn:{id:'test-turn',status:'completed'}}});
  }else throw Error('Unexpected RPC '+message.method);
 }catch(error){send({id:message.id,error:{code:-32000,message:error.stack}})}
}
