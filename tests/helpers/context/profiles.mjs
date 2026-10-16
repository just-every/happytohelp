import assert from 'node:assert/strict'
import {contextApp,model} from './app.mjs'

const fields=['upcoming_events','user_type','problem','solutions_needed','job','role','risk_profile','personality']
const unknown={value:null,confidence:null,evidence_status:'unknown',evidence_ids:[]}
// The packet names each evidence row by its source kind and id, as the model sees it.
const cited=body=>JSON.stringify(body).match(/message:[0-9a-f-]{36}/)[0]

// Attributed contact profiles: generated from current evidence only, unchanged evidence is a no-op, corrections
// retract claims, consent loss mid-run supersedes the write, and an uncertain paid attempt is never retried.
export async function profilesJourney(){
 const c=await contextApp(),{app,ai,context}=c
 const profile=subject=>app.first("SELECT profile FROM context_profiles WHERE subject_id=? AND type='contact'",subject).then(row=>JSON.parse(row?.profile||'null'))
 const generate=async(subject,kind='contact',chosen=model)=>(await context(`/${subject}/generate/${kind}`,{body:{model:chosen}})).data
 const restart=subject=>app.db.prepare("UPDATE context_profiles SET started_at=0 WHERE subject_id=? AND type='contact'").bind(subject).run()
 try{
  const v=await c.visitor('Profiled visitor'),subject=v.contactId
  assert.equal((await generate(subject)).reason,'consent_or_bot_disabled','no profile without the visitor\'s consent')
  await context(`/${subject}/consent`,{method:'PUT',body:{consent:true},status:200});await context(`/${subject}/monitoring`,{method:'PUT',body:{enabled:true,helpTypes:['support']},status:200})
  const evidence=(await context(`/${subject}/evidence`,{body:{source:'customer_message',content:'I am a developer'},status:201})).data.id;assert.ok(evidence)
  // A supported claim cites current evidence and is published.
  let answer=(claim)=>Object.fromEntries(fields.map(key=>[key,key==='user_type'?claim:unknown]))
  ai.answer=(_,body)=>answer({value:'developer',confidence:90,evidence_status:'supported',evidence_ids:[cited(body)]})
  assert.ok((await generate(subject)).id);for(const job of await app.takeJobs())await app.runJobs([job])
  assert.equal((await profile(subject)).user_type.value,'developer')
  assert.equal((await generate(subject)).reason,'unchanged_evidence','unchanged evidence makes no new request')
  await app.db.prepare("UPDATE context_evidence SET content='I am not a developer' WHERE id=?").bind(evidence).run()
  assert.equal((await generate(subject)).reason,'profile_cooldown')
  // A contradicted result retracts the attributed claim.
  await restart(subject);ai.answer=(_,body)=>answer({value:null,confidence:null,evidence_status:'contradicted',evidence_ids:[cited(body)]})
  assert.ok((await generate(subject)).id);for(const job of await app.takeJobs())await app.runJobs([job]);assert.equal((await profile(subject)).user_type,undefined)
  // Consent withdrawn while the model answers: the job is superseded and writes nothing.
  await restart(subject);await app.db.prepare("UPDATE context_evidence SET content='New fact' WHERE id=?").bind(evidence).run()
  ai.answer=async(_,body)=>{await app.db.prepare('UPDATE context_subjects SET consent=0 WHERE subject_id=?').bind(subject).run();return answer({value:'developer',confidence:90,evidence_status:'supported',evidence_ids:[cited(body)]})}
  const stale=await generate(subject);for(const job of await app.takeJobs())await app.runJobs([job])
  assert.equal((await app.first('SELECT state FROM context_jobs WHERE id=?',stale.id)).state,'superseded');assert.equal((await app.first('SELECT count(*) n FROM context_write_guards')).n,0)
  assert.equal((await profile(subject)).user_type,undefined)
  // A run interrupted after the provider started is uncertain: never retried, it holds new runs until review abandons it.
  await context(`/${subject}/consent`,{method:'PUT',body:{consent:true},status:200});await restart(subject)
  const uncertain=await generate(subject);const [queued]=await app.takeJobs()
  await app.db.prepare("UPDATE context_jobs SET state='running',started_at=0,provider_started=1 WHERE id=?").bind(uncertain.id).run();await app.scheduled()
  const calls=ai.calls.length;await app.runJobs([queued]);assert.equal(ai.calls.length,calls,'an unknown attempt is never retried')
  assert.equal((await app.first('SELECT state FROM context_jobs WHERE id=?',uncertain.id)).state,'uncertain');assert.notEqual((await generate(subject)).reason,'queued')
  assert.equal((await context(`/${subject}/jobs/${uncertain.id}/abandon`,{body:{reason:'Reviewed provider logs'},status:200})).data.abandoned,true)
  // A model whose provider key is not installed fails closed without a request.
  const unconfigured=await c.visitor('Unconfigured visitor');await unconfigured.widget('contextConsent',{consent:true},200)
  await context(`/${unconfigured.contactId}/evidence`,{body:{source:'customer_message',content:'I run a shop'},status:201})
  const refused=await generate(unconfigured.contactId,'contact','claude-haiku-4-5-20251001');for(const job of await app.takeJobs())await app.runJobs([job])
  const failed=await app.first('SELECT state,error FROM context_jobs WHERE id=?',refused.id);assert.equal(failed.state,'failed');assert.match(failed.error,/CONFIGURATION_REQUIRED/);assert.equal(ai.calls.length,calls)
 }finally{await c.close()}
}

// The workspace's insight inventory pages completely and stays inside the workspace and its members.
export async function inventoryJourney(){
 const c=await contextApp(),{app,p,context}=c
 try{
  const foreign=await app.seedWorkspace('foreign')
  for(let index=0;index<55;index+=25)await app.db.batch(Array.from({length:Math.min(25,55-index)},(_,n)=>app.db.prepare('INSERT INTO context_insights VALUES(?,?,?,?,?,?,?,?,NULL)').bind(`i${String(index+n).padStart(3,'0')}`,p,'subject','support',`Insight ${index+n}`,'[]','[]',100)))
  await app.db.prepare("INSERT INTO context_insights VALUES('foreign',?,'other','support','Private foreign insight','[]','[]',100,NULL)").bind(foreign.projectId).run()
  assert.equal((await app.call(`/api/customer-context/${p}/insights`)).status,401);assert.equal((await app.call(`/api/customer-context/${foreign.projectId}/insights`,{token:c.operator})).status,403)
  const first=(await context('/insights',{status:200})).data;assert.equal(first.data.length,50);assert.ok(first.nextCursor)
  const last=(await context('/insights?cursor='+encodeURIComponent(first.nextCursor),{status:200})).data;assert.equal(last.data.length,5);assert.equal(last.nextCursor,null)
  assert.equal(new Set([...first.data,...last.data].map(row=>row.id)).size,55);assert.doesNotMatch(JSON.stringify(first),/Private foreign insight/)
  assert.equal((await context('/insights?cursor=invalid')).status,400)
  // Operator context inputs are validated before they are stored.
  for(const [path,method,body] of [['/s/consent','PUT',{consent:'yes'}],['/s/evidence','POST',{source:'invented',content:'x'}],['/s/monitoring','PUT',{enabled:true,helpTypes:'support'}],['/s/profiles/unknown','PUT',{profile:{}}]])
   assert.equal((await context(path,{method,body})).status,400,path)
 }finally{await c.close()}
}
