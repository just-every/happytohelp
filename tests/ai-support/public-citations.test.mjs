import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const require=createRequire(import.meta.url)
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
test('native/dataset public citations: issued versions, atomic admission, REST and socket replay',async()=>{
 const bundle=await build({entryPoints:['tests/ai-support/citation-worker.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],logLevel:'silent'})
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],bindings:{APP_ORIGIN:'https://support.example'},d1Databases:['DB'],durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}}}))
 try{
  const db=await mf.getD1Database('DB')
  for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile('migrations/'+name,'utf8')).replace(/^--.*$/gm,'').replaceAll('\n',' '))
  await db.exec(`INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','key','https://widget.example',1),('q','Other','qkey','https://other.example',1);
   INSERT INTO contacts(id,project_id,name,created_at) VALUES('ct','p','Customer',1);
   INSERT INTO users(id,email,name,created_at) VALUES('u','operator@example.test','Owner',1);INSERT INTO memberships VALUES('p','u','owner');
   INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES('a','p','refunds','Refund policy','Refund within 30 days.','published',1),('draft','p','secret','Refund secret','Private','draft',1),('foreign','q','foreign','Refund foreign','Foreign','published',1);
   INSERT INTO knowledge_datasets(id,project_id,name,created_at) VALUES('ds','p','Dataset',1);
   INSERT INTO knowledge_versions(id,dataset_id,fingerprint,created_at) VALUES('v','ds','fp',1);
   INSERT INTO knowledge_documents(id,version_id,url,title,content) VALUES('doc','v','https://docs.example','Dataset refunds','Refund details'),('private','v','h2h://conversation/ct','Refund history','Private history');
   UPDATE knowledge_datasets SET published_version='v',status='failed' WHERE id='ds';
   INSERT INTO ai_profiles VALUES('ai','p','Assistant','support','Use policy','gpt-5.6-luna',1,0,NULL,1);`)
  const call=async(path,body)=>{const r=await mf.dispatchFetch('http://local'+path,{method:'POST',body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
  const seed=async id=>{
   await db.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,1,1)').bind(id,'p','ct').run()
   await db.prepare('INSERT INTO conversation_ai VALUES(?,?)').bind(id,'ai').run()
   await db.prepare(`INSERT INTO ai_generations(id,project_id,conversation_id,state,source_revision,source_context_revision,actor_json,model,ai_id,ai_profile_json,created_at,updated_at) SELECT ?,?,?, 'running',0,revision,?,'gpt-5.6-luna','ai','{"model":"gpt-5.6-luna","prompt":"Use policy"}','now','now' FROM context_subjects WHERE project_id='p' AND subject_id='ct'`).bind('g-'+id,'p',id,JSON.stringify({id:'ct',contactId:'ct',projectId:'p',role:'contact'})).run()
   await db.prepare("INSERT INTO ai_attempts(id,generation_id,state,started_at) VALUES(?,?,'running','now')").bind('attempt-'+id,'g-'+id).run()
   const r=await call('/tools',{generationId:'g-'+id,query:'refund'});assert.equal(r.status,200,JSON.stringify(r.data));return r.data
  }
  const first=await seed('one')
  assert.deepEqual(first.rows.map(r=>r.id).sort(),['article:a','knowledge:doc','knowledge:private'])
  assert.deepEqual(first.selected.map(r=>r.id).sort(),['article:a','knowledge:doc'])
  assert.equal(first.rows.find(r=>r.id==='article:a').url,'https://support.example/help/p/refunds')
  const ref=first.selected.find(r=>r.id==='article:a')
  assert.equal((await call('/eligible',{projectId:'p',id:'a'})).data,true)
  assert.equal((await call('/eligible',{projectId:'p',id:'draft'})).data,false)
  assert.equal((await call('/read',{projectId:'q',ref})).data,null)
  assert.equal((await call('/tools',{generationId:'g-one',query:'refund',refs:[{id:'note:secret',sourceVersion:'x'}]})).status,409)
  assert.equal((await call('/tools',{generationId:'g-one',query:'refund',refs:[{id:'knowledge:private',sourceVersion:'v'}]})).status,409)
  assert.equal((await call('/finalize',{generationId:'g-one',attemptId:'attempt-one',refs:[{id:'article:foreign',sourceVersion:'fabricated'}]})).status,409)
  const admitted=await call('/finalize',{generationId:'g-one',attemptId:'attempt-one',refs:first.selected})
  assert.equal(admitted.data.accepted,true,JSON.stringify(admitted))
  const citations=JSON.parse(admitted.data.message.citations_json)
  assert.equal(citations[0].url,'https://support.example/help/p/refunds')
  assert.equal(citations.find(c=>c.id==='knowledge:doc').url,'https://docs.example','admission preserves a safe dataset URL without imposing browser normalization')
  const repeat=await call('/admit',{projectId:'p',conversationId:'one',actor:{id:'ct',contactId:'ct',projectId:'p',role:'contact'},localId:'generation:g-one',content:'Policy answer',expectedRevision:0,expectedLastMessageId:null,generationId:'g-one',citations:first.selected})
  assert.equal(repeat.data.duplicate,true)
  assert.equal((await db.prepare("SELECT count(*) n FROM messages WHERE conversation_id='one'").first()).n,1)
  const token='visitor-token';await db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,NULL)').bind(createHash('sha256').update(token).digest('hex'),'ct','p','contact','ct',Date.now()+60000).run()
  const rest=await mf.dispatchFetch('https://support.example/conversations/one/messages',{headers:{Authorization:'Bearer '+token}})
  assert.deepEqual((await rest.json()).messages[0].citations_json,JSON.stringify(citations))
  const replay=await mf.dispatchFetch('https://support.example/conversations/one/socket?token='+token,{headers:{Upgrade:'websocket'}})
  assert.equal(replay.status,101);const socket=replay.webSocket;socket.accept()
  const frame=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Replay deadline')),5000);socket.addEventListener('message',event=>{const f=JSON.parse(event.data);if(f.type==='message'){clearTimeout(timer);resolve(f)}});socket.send(JSON.stringify({type:'replay'}))})
  assert.equal(frame.message.id,admitted.data.message.id);assert.deepEqual(JSON.parse(frame.message.citations_json),citations);socket.close()
  await db.exec("UPDATE knowledge_articles SET content='Publication changed after final admission' WHERE id='a'")
  const replayAfterEdit=await call('/admit',{projectId:'p',conversationId:'one',actor:{id:'ct',contactId:'ct',projectId:'p',role:'contact'},localId:'generation:g-one',content:'Policy answer',expectedRevision:0,expectedLastMessageId:null,generationId:'g-one',citations:first.selected});assert.equal(replayAfterEdit.data.duplicate,true)
  await seed('context-changed')
  await db.exec("INSERT INTO conversation_notes VALUES('note','context-changed','u','Private note',1)")
  const contextChanged=await call('/finalize',{generationId:'g-context-changed',attemptId:'attempt-context-changed',refs:[]});assert.equal(contextChanged.data.accepted,false,'first customer context exists before private note mutation')
  const race=await seed('race')
  const raceInput={projectId:'p',conversationId:'race',actor:{id:'ct',contactId:'ct',projectId:'p',role:'contact'},localId:'generation:g-race',content:'Policy answer',expectedRevision:0,expectedLastMessageId:null,generationId:'g-race',citations:race.selected,mutateBeforeBatch:"UPDATE knowledge_articles SET status='draft' WHERE id='a'"}
  assert.equal((await call('/admit',raceInput)).data.accepted,false,'unpublication between resolution and atomic insert denies the answer')
  assert.equal((await db.prepare("SELECT count(*) n FROM messages WHERE conversation_id='race'").first()).n,0)
  await db.exec("UPDATE knowledge_articles SET status='published' WHERE id='a'")
  const datasetRace=await seed('dataset-race')
  assert.equal((await call('/admit',{...raceInput,conversationId:'dataset-race',localId:'generation:g-dataset-race',generationId:'g-dataset-race',citations:datasetRace.selected.filter(r=>r.id==='knowledge:doc'),mutateBeforeBatch:"UPDATE knowledge_datasets SET published_version=NULL WHERE id='ds'"})).data.accepted,false,'dataset publication is rechecked atomically')
  await db.exec("UPDATE knowledge_datasets SET published_version='v' WHERE id='ds'")
  const stale=(await seed('stale')).selected.find(r=>r.id==='article:a');await db.exec("UPDATE knowledge_articles SET content='New publication' WHERE id='a'")
  assert.equal((await call('/read',{projectId:'p',ref})).data,null)
  assert.equal((await call('/finalize',{generationId:'g-stale',attemptId:'attempt-stale',refs:[stale]})).status,409)
  const current=(await seed('deleted')).selected
  await db.exec("INSERT INTO project_settings VALUES('p','{\"deleted_at\":1}',1)")
  assert.equal((await call('/read',{projectId:'p',ref:current[0]})).data,null)
  assert.equal((await call('/search',{projectId:'p',query:'refund'})).status,409)
  assert.equal((await call('/finalize',{generationId:'g-deleted',attemptId:'attempt-deleted',refs:current})).status,409)
  await db.exec("UPDATE project_settings SET settings_json='{}' WHERE project_id='p'")
  await seed('missing-subject');await db.exec("DELETE FROM context_subjects WHERE project_id='p' AND subject_id='ct'")
  const missing=await call('/finalize',{generationId:'g-missing-subject',attemptId:'attempt-missing-subject',refs:[]})
  assert.equal(missing.data.accepted,false,'an absent subject must never admit revision zero')
 }finally{await mf.dispose()}
})
