// Run the identity flow beside native D1: prepare/bind must not cross the
// Node platform proxy's synchronous worker-thread transport.
import assert from 'node:assert/strict'
import {receiveEmail} from '../../src/modules/integrations/inbound-service.ts'
import {scheduleInboundEffects} from '../../src/modules/integrations/inbound-effects.ts'
import {requestGeneration} from '../../src/modules/ai-support/repository.ts'
import {runScheduled} from '../../src/jobs.ts'

export default {async fetch(request,env){
 const migrations=await request.json()
 const broadcasts=[],queued=[]
 // The socket broadcast and the job queue are observed, not exercised: this test is about D1 command identity.
 const conversations={idFromName:name=>name,get:name=>({fetch:async()=>{broadcasts.push(name);return new Response(null,{status:204})}})}
 const withoutProvider={...env,CONVERSATIONS:conversations,JOBS:{send:async job=>{queued.push(job)}}}
 for(const key of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY'])delete withoutProvider[key]
 const DB=withoutProvider.DB
 // D1 exec runs one statement per line; migrations only use whole-line comments.
 for(const migration of migrations)await DB.exec(migration.split('\n').filter(line=>!line.trim().startsWith('--')).join(' '))
 await DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','w','https://example.com',1)").run()
 await DB.prepare("INSERT INTO email_settings VALUES('p','Support','support@example.com','inbound@example.com',1,1)").run()
 await DB.prepare("INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,is_enabled,created_at) VALUES('ai','p','Assistant','reply','Use evidence','gpt-5.6-luna',1,1)").run()
 await DB.prepare("INSERT INTO contacts(id,project_id,email,created_at) VALUES('ct','p','customer@example.com',1)").run()
 const seedConversation=async id=>{await DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,'p','ct',1,1)").bind(id).run();await DB.prepare("INSERT INTO conversation_ai(conversation_id,ai_id) VALUES(?,'ai')").bind(id).run()}
 const pendingOutbox=id=>DB.prepare('SELECT count(*) n FROM conversation_outbox WHERE conversation_id=? AND delivered_at IS NULL').bind(id).first().then(r=>r.n)
 const generations=id=>DB.prepare('SELECT id,state,actor_json FROM ai_generations WHERE conversation_id=?').bind(id).all().then(r=>r.results)
 const deliverEmail=async(env,conversationId,messageId)=>{
  const result=await receiveEmail(env,{messageId,to:`inbound+${conversationId}@example.com`,from:'customer@example.com',text:'Where is my order?'})
  assert.equal(result.state,'delivered');assert.equal(result.duplicate,false)
  // First delivery runs the Worker's inbound effects with the email receipt's actor.
  const pending=[];scheduleInboundEffects(env,{waitUntil:promise=>pending.push(promise)},result);await Promise.all(pending)
  return result
 }

 // A missing provider key records the generation as failed, so every later replay compares against it.
 await seedConversation('failed-conv')
 const failed=await deliverEmail(withoutProvider,'failed-conv','<failed@example.com>')
 const [failedGeneration]=await generations('failed-conv')
 assert.equal(failedGeneration.id,`reply:${failed.message.id}`);assert.equal(failedGeneration.state,'failed')
 assert.equal(await pendingOutbox('failed-conv'),1)
 await runScheduled(withoutProvider)
 assert.equal(await pendingOutbox('failed-conv'),0,'scheduled replay reaches the recorded generation command and marks the outbox delivered')
 assert.deepEqual((await generations('failed-conv')).map(g=>[g.id,g.state]),[[failedGeneration.id,'failed']],'replay neither conflicts with nor duplicates the recorded command')
 assert.equal(failedGeneration.actor_json,'{"contactId":"ct","id":"ct","projectId":"p","role":"contact"}','new commands store the actor canonically')

 // A queued generation is replayed by the scheduler before a worker completes it.
 const withProvider={...withoutProvider,OPENAI_API_KEY:'sk-test-never-called',APP_ORIGIN:'https://support.example'}
 await seedConversation('queued-conv')
 const pendingReply=await deliverEmail(withProvider,'queued-conv','<queued@example.com>')
 assert.deepEqual((await generations('queued-conv')).map(g=>[g.id,g.state]),[[`reply:${pendingReply.message.id}`,'queued']])
 assert.deepEqual(queued.map(job=>job.id),[`reply:${pendingReply.message.id}`])
 assert.equal(JSON.parse((await DB.prepare('SELECT options_json FROM ai_generations WHERE id=?').bind(`reply:${pendingReply.message.id}`).first()).options_json).application_origin,'https://support.example')
 await runScheduled({...withProvider,APP_ORIGIN:undefined})
 assert.equal(await pendingOutbox('queued-conv'),0,'scheduled replay of a queued email generation is idempotent')
 assert.equal((await generations('queued-conv')).length,1)

 // Rows written before canonical serialization keep whatever key order their writer used.
 await seedConversation('legacy-conv')
 const legacy=await receiveEmail(withoutProvider,{messageId:'<legacy@example.com>',to:'inbound+legacy-conv@example.com',from:'customer@example.com',text:'Legacy receipt'})
 const legacyId=`reply:${legacy.message.id}`
 await DB.prepare("INSERT INTO ai_generations(id,project_id,conversation_id,state,source_revision,source_last_message_id,actor_json,model,ai_id,ai_profile_json,kind,instruction,options_json,created_at,updated_at) VALUES(?,'p','legacy-conv','failed',?,?,?,'gpt-5.6-luna','ai','{}','reply','','{}','x','x')").bind(legacyId,legacy.message.revision,legacy.message.id,'{"id":"ct","contactId":"ct","projectId":"p","role":"contact"}').run()
 await runScheduled(withoutProvider)
 assert.equal(await pendingOutbox('legacy-conv'),0,'a stored actor in another key order is the same command')
 assert.equal((await generations('legacy-conv')).length,1)

 // Canonical comparison does not widen identity: a different actor is still a conflict.
 await assert.rejects(requestGeneration(withoutProvider,{projectId:'p',conversationId:'legacy-conv',actor:{id:'other',contactId:'other',projectId:'p',role:'contact'},expectedRevision:legacy.message.revision,id:legacyId},'record'),/Generation command conflict/)
 await assert.rejects(requestGeneration(withoutProvider,{projectId:'p',conversationId:'legacy-conv',actor:{id:'ct',projectId:'p',role:'contact'},expectedRevision:legacy.message.revision,id:legacyId},'record'),/Generation command conflict/)
 assert.equal((await requestGeneration(withoutProvider,{projectId:'p',conversationId:'legacy-conv',actor:{role:'contact',projectId:'p',contactId:'ct',id:'ct'},expectedRevision:legacy.message.revision,id:legacyId},'record')).state,'failed')
 assert.ok(broadcasts.includes('failed-conv')&&broadcasts.includes('project:p'))
 return Response.json({ok:true})
}}
