import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {readFile,readdir} from 'node:fs/promises'
const require=createRequire(import.meta.url)
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
test('model tool selection survives generation/finalization; switch_agent transfers authority',async()=>{
 const bundle=await build({entryPoints:['tests/ai-support/lifecycle-worker.ts'],write:false,bundle:true,format:'esm',platform:'node',external:['node:*','cloudflare:workers'],logLevel:'silent'})
 let calls=0,publication,mode='answer'
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],bindings:{OPENAI_API_KEY:'sk-test',APP_ORIGIN:'https://support.example'},d1Databases:['DB'],r2Buckets:['FILES'],durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}},outboundService:async request=>{
  const body=await request.json();calls++
  assert.ok(body.tools.some(t=>t.name==='cite_knowledge'));assert.ok(body.tools.some(t=>t.name==='switch_agent'))
  const usage={input_tokens:5,output_tokens:2,total_tokens:7,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}
  let events
  if(mode==='handoff'||calls<3){
   const name=mode==='handoff'?'switch_agent':calls===1?'search_knowledge':'cite_knowledge'
   const args=JSON.stringify(mode==='handoff'?{agent_id:'human'}:calls===1?{query:'refund'}:{sources:[{id:'article:a',sourceVersion:publication}]})
   if(calls===2){assert.match(JSON.stringify(body.input),/article:a/);assert.ok(JSON.stringify(body.input).includes(publication))}
   const item={id:'fc-'+calls,type:'function_call',call_id:'call-'+calls,name,arguments:args}
   events=[{type:'response.output_item.added',item:{...item,arguments:''}},{type:'response.function_call_arguments.done',item_id:item.id,arguments:args},{type:'response.completed',response:{output:[item],usage}}]
  }else{
   assert.match(JSON.stringify(body.input),/Refund policy/)
   const text='Refunds are available within 30 days.'
   events=[{type:'response.output_text.delta',item_id:'msg',delta:text},{type:'response.output_text.done',item_id:'msg',text},{type:'response.completed',response:{usage}}]
  }
  return new Response(events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})
 }}))
 try{
  const db=await mf.getD1Database('DB');for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile('migrations/'+name,'utf8')).replace(/^--.*$/gm,'').replaceAll('\n',' '))
  await db.exec(`INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','key','https://widget.example',1);INSERT INTO contacts(id,project_id,name,created_at) VALUES('ct','p','Customer',1);INSERT INTO users(id,email,name,created_at) VALUES('u','owner@example.test','Owner',1);INSERT INTO memberships VALUES('p','u','owner');INSERT INTO ai_profiles VALUES('ai','p','Assistant','support','Use evidence','gpt-5.4-mini',1,0,NULL,1);INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES('a','p','refunds','Refund policy','Refund within 30 days.','published',1);`)
  publication=(await db.prepare("SELECT publication_version FROM knowledge_articles WHERE id='a'").first()).publication_version
  const actor={id:'ct',contactId:'ct',projectId:'p',role:'contact'}
  const call=async(path,input)=>{const r=await mf.dispatchFetch('http://local'+path,{method:'POST',body:JSON.stringify(input)});assert.equal(r.status,200,await r.clone().text());return r.json()}
  const seed=async id=>{await db.prepare('INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,created_at,updated_at) VALUES(?,?,?,1,?,1,1)').bind(id,'p','ct','m-'+id).run();await db.prepare('INSERT INTO conversation_ai VALUES(?,?)').bind(id,'ai').run();await db.prepare('INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES(?,?,?,?,?,?,?,1,1)').bind('m-'+id,'p',id,'customer','ct','contact',mode==='handoff'?'I need a human':'What is the refund window?').run();await call('/request',{id:'g-'+id,projectId:'p',conversationId:id,actor,expectedRevision:1});await call('/handle',{type:'ai.generate',id:'g-'+id,projectId:'p'})}
  await seed('answer');assert.equal(calls,3,JSON.stringify(await db.prepare("SELECT state,error,output_json FROM ai_generations WHERE id='g-answer'").first()))
  const answer=await db.prepare("SELECT * FROM messages WHERE actor_role='ai'").first();assert.ok(answer)
  assert.deepEqual(JSON.parse(answer.citations_json),[{id:'article:a',sourceVersion:publication,title:'Refund policy',url:'https://support.example/help/p/refunds'}])
  assert.equal((await db.prepare("SELECT state FROM ai_generations WHERE id='g-answer'").first()).state,'completed')
  assert.equal((await db.prepare('SELECT count(*) n FROM conversation_outbox WHERE message_id=?').bind(answer.id).first()).n,1)
  mode='handoff';await seed('handoff')
  assert.equal((await db.prepare("SELECT assigned_to FROM conversations WHERE id='handoff'").first()).assigned_to,'u')
  assert.equal((await db.prepare("SELECT ai_id FROM conversation_ai WHERE conversation_id='handoff'").first()).ai_id,null)
  assert.equal((await db.prepare("SELECT state FROM ai_generations WHERE id='g-handoff'").first()).state,'superseded')
  assert.equal((await db.prepare("SELECT count(*) n FROM messages WHERE conversation_id='handoff' AND actor_role='ai'").first()).n,0)
  const reply=await call('/admit',{projectId:'p',conversationId:'handoff',actor:{id:'u',projectId:'p',role:'owner'},localId:'operator',content:'Human reply',expectedRevision:1,expectedLastMessageId:'m-handoff'});assert.equal(reply.accepted,true)
 }finally{await mf.dispose()}
})
