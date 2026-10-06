import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]})),{Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));

// Contact erasure cancels running generations. A provider response for a generation
// cancelled in flight must not write generated text back into the erased record.
test('a generation cancelled while the provider runs keeps usage but not provider output',async()=>{
 const bundle=await build({entryPoints:['tests/ai-support/lifecycle-worker.ts'],write:false,bundle:true,format:'esm',platform:'node',external:['node:*','cloudflare:workers'],logLevel:'silent'});let db,calls=0;
 const reply='Generated reply that quotes the erased customer';
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],bindings:{OPENAI_API_KEY:'sk-test'},d1Databases:['DB'],r2Buckets:['FILES'],durableObjects:{CONVERSATIONS:'ConversationSocket'},outboundService:async()=>{calls++;
  // The erasure commits while the provider request is in flight.
  await db.prepare("UPDATE ai_generations SET state='cancelled' WHERE id='erased-generation' AND state='running'").run();
  const events=[{type:'response.output_text.delta',item_id:'msg1',delta:reply},{type:'response.output_text.done',item_id:'msg1',text:reply},{type:'response.completed',response:{usage:{input_tokens:5,output_tokens:2,total_tokens:7,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}}}];
  return new Response(events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})}}));
 try{
  db=await mf.getD1Database('DB');for(const file of ['0001_identity.sql','0002_conversations.sql','0004_message_intent.sql','0005_widget_identity.sql','0050_knowledge.sql','0060_customer_context.sql','0060_customer_context_engine.sql','0070_management.sql','0080_integrations.sql','0081_billing_receipts.sql','020_ai_support.sql','0085_ai_context_guards.sql','0051_knowledge_authoring.sql','0105_edition_delegation.sql','0108_public_answer_citations.sql'])await db.exec((await readFile(`migrations/${file}`,'utf8')).replace(/^\s*--[^\n]*$/gm,'').replaceAll('\n',' '));
  await db.exec("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://example.test',1);INSERT INTO contacts(id,project_id,name,created_at) VALUES('contact','p','Name',1);INSERT INTO ai_profiles VALUES('ai','p','Selected assistant','support','Use evidence','gpt-5.6-luna',1,0,NULL,1);INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,created_at,updated_at) VALUES('erased','p','contact',1,'erased-message',1,1);INSERT INTO conversation_ai VALUES('erased','ai');INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('erased-message','p','erased','local','contact','contact','Question',1,1);");
  await db.prepare("INSERT INTO ai_generations(id,project_id,conversation_id,state,source_revision,source_last_message_id,actor_json,model,ai_id,ai_profile_json,created_at,updated_at) VALUES('erased-generation','p','erased','queued',1,'erased-message',?,'gpt-5.6-luna','ai',?,?,?)").bind(JSON.stringify({id:'contact',contactId:'contact',projectId:'p',role:'contact'}),JSON.stringify({id:'ai',model:'gpt-5.6-luna',prompt:'Use evidence'}),new Date().toISOString(),new Date().toISOString()).run();
  await db.prepare("UPDATE ai_generations SET source_context_revision=(SELECT revision FROM context_subjects WHERE project_id='p' AND subject_id='contact') WHERE id='erased-generation'").run();
  const response=await mf.dispatchFetch('http://local/',{method:'POST',body:JSON.stringify({type:'ai.generate',id:'erased-generation',projectId:'p'})});assert.equal(response.status,200,await response.text());
  const row=await db.prepare("SELECT state,output_json FROM ai_generations WHERE id='erased-generation'").first();
  assert.equal(calls,1);assert.equal(row.state,'cancelled');
  assert.equal(JSON.parse(row.output_json||'{}').result,undefined,'provider output is not retained');assert.equal(String(row.output_json).includes(reply),false);
  assert.equal((await db.prepare("SELECT count(*) total FROM messages WHERE conversation_id='erased'").first()).total,1,'no reply admitted');
  assert.ok(JSON.parse(row.output_json).usage,'usage accounting is kept');assert.equal((await db.prepare('SELECT count(*) total FROM ai_round_usage').first()).total,1,'the provider round stays recorded');
 }finally{await mf.dispose()}
});
