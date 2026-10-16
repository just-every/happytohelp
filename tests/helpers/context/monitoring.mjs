import assert from 'node:assert/strict'
import {contextApp} from './app.mjs'

const evidenceIds=body=>[...new Set(JSON.stringify(body).match(/action:[a-z0-9-]+/g)||[])]
const actions=(prefix,count,text)=>Array.from({length:count},(_,i)=>({localId:`${prefix}${i}`,action:`${text} ${i}`}))

// Proactive help from a consenting visitor's widget activity, through the widget events door and the queue.
export async function monitoringJourney(){
 const c=await contextApp(),{app,ai,p}=c
 const count=(table,where='1=1',...args)=>app.first(`SELECT count(*) n FROM ${table} WHERE ${where}`,...args).then(row=>row.n)
 const runAll=async(twice=false)=>{for(const job of await app.takeJobs()){await app.runJobs([job]);if(twice)await app.runJobs([job])}}
 try{
  const v=await c.visitor('Monitored visitor'),subject=v.contactId
  // Nothing is collected before the visitor consents; consent is the visitor's own decision.
  assert.equal((await v.widget('collector',actions('early',2,'Clicked'),200)).data.accepted,0)
  assert.equal((await v.widget('contextConsent',{consent:true},200)).data.monitoring.enabled,true)
  await c.context(`/${subject}/evidence`,{body:{source:'agent_message',content:'AGENT DRAFT NEVER IN MONITORING'},status:201})
  // Idle telemetry is not evidence; activity is counted once per local id and analysed once due.
  assert.equal((await v.widget('collector',[{localId:'idle',action:'Detected extended inactivity (120 seconds without interaction) - User may be hesitating.'}],200)).data.accepted,0)
  assert.equal((await v.widget('collector',actions('a',5,'Password reset failed step'),200)).data.job.reason,'awaiting_activity')
  assert.ok((await v.widget('collector',[{localId:'a5',action:'Password reset failed step 5'},{localId:'a6',action:'Password reset failed step 6'},{localId:'a0',action:'duplicate'}],200)).data.job.id)
  assert.equal((await app.first('SELECT actions_count FROM context_collectors WHERE subject_id=?',subject)).actions_count,7)
  // No insight: one analysis and one summary even when the job is delivered twice; activity compacts into the summary.
  ai.answer=name=>name==='context_summary'?{summary:'Seven password reset failures were observed.'}:{decision:'no_insight',help_type:null,evidence_ids:[],help:null}
  await runAll(true);assert.deepEqual(ai.calls.map(call=>call.name),['context_analysis','context_summary'])
  const analysis=JSON.stringify(ai.calls[0].body);assert.match(analysis,/untrusted/i,'activity is labelled untrusted for the model');assert.doesNotMatch(analysis,/AGENT DRAFT NEVER IN MONITORING/)
  assert.equal(await count('context_insights'),0,'no fabricated insight');assert.equal(await count('context_actions','subject_id=?',subject),0);assert.equal(await count('context_summaries','subject_id=?',subject),1)
  // A burst arriving just after a run waits for the schedule; the widget's concurrent retries then admit exactly one run.
  assert.equal((await v.widget('collector',actions('b',8,'Payment declined'),200)).data.job.reason,'schedule_gate')
  await app.db.prepare('UPDATE context_collectors SET last_run_at=0 WHERE subject_id=?').bind(subject).run();ai.calls.length=0
  const retries=await Promise.all([v.widget('pingAction',{},200),v.widget('pingAction',{},200)]);assert.equal(retries.filter(retry=>retry.data.job?.id).length,1,'one run for concurrent retries')
  assert.equal(await count('context_jobs',"state='queued'"),1)
  // The burst is analysed with the historical summary, and an attributable insight is offered to the visitor.
  ai.answer=(name,body)=>{const evidence=evidenceIds(body)[0];return name==='context_analysis'?{decision:'insight',help_type:'support',evidence_ids:[evidence],help:'Help with payment'}:name==='context_insight'?{content:'Would you like help with your payment?',buttons:[{text:'Yes, help me',action:'send'},{text:'Dismiss',action:'close'}],loading:null,evidence_ids:[evidence]}:{summary:'Payment errors were observed.'}}
  await runAll();assert.match(JSON.stringify(ai.calls[0].body),/Seven password reset failures were observed/,'the historical summary informs the next analysis')
  const offered=(await v.widget('insights',{},200)).data.insights;assert.equal(offered.length,1);assert.equal(offered[0].content,'Would you like help with your payment?')
  // Choosing an offered response admits the insight and the visitor's reply as one pair, once; a forged response is refused.
  const use=(text,localId)=>app.call(`/api/conversations/${v.conversationId}/widget-events`,{token:v.token,body:{action:'useInsight',data:{insight_id:offered[0].id,text,local_id:localId,ai_message:{local_id:localId+'-ai'}}}})
  assert.equal((await use('Forged button','forged')).status,400)
  const pair=await use('Yes, help me','use-1');assert.equal(pair.status,200,JSON.stringify(pair.data));assert.equal(pair.data.messages.length,2)
  assert.equal((await use('Yes, help me','use-1')).data.duplicate,true);await app.takeJobs()
  const transcript=(await app.call(`/api/conversations/${v.conversationId}/messages`,{token:v.token,status:200})).data.messages.map(message=>message.content)
  assert.deepEqual(transcript.slice(-2),['Would you like help with your payment?','Yes, help me'])
  // A dismissed insight stays dismissed, and stops further model requests for that visitor.
  assert.equal((await v.widget('dismissInsight',offered[0].id,200)).data.dismissed,true);assert.deepEqual((await v.widget('insights',{},200)).data.insights,[])
  await app.db.prepare('UPDATE context_collectors SET last_run_at=0 WHERE subject_id=?').bind(subject).run();const calls=ai.calls.length
  await v.widget('collector',actions('c',8,'New issue'),200);await runAll();assert.equal(ai.calls.length,calls,'dismissal blocks model requests')
  // Page visits are tracked once; other event types and other visitors' conversations are refused.
  const page=[{localId:'page',type:'PAGE_VIEW',payload:{url:'/help'}},{localId:'ignored',type:'UNSUPPORTED',payload:{}}]
  assert.equal((await v.widget('saveEvents',page,200)).data.counts[0].count,1);assert.equal((await v.widget('saveEvents',page.slice(0,1),200)).data.counts[0].count,1)
  const other=await c.visitor('Other visitor')
  assert.equal((await app.call(`/api/conversations/${v.conversationId}/widget-events`,{token:other.token,body:{action:'collector',data:actions('x',1,'cross')}})).status,404)

  // A large burst is analysed and summarised in bounded windows; the summary takes the oldest evidence and leaves the rest.
  const bounded=await c.visitor('Busy visitor');await bounded.widget('contextConsent',{consent:true},200);ai.calls.length=0
  ai.answer=name=>name==='context_summary'?{summary:'Many failures were observed.'}:{decision:'no_insight',help_type:null,evidence_ids:[],help:null}
  await bounded.widget('collector',actions('bound',70,'Observed failure'),200)
  const oldest=(await app.first('SELECT id FROM context_actions WHERE subject_id=? ORDER BY occurred_at,id LIMIT 1',bounded.contactId)).id
  await runAll();const [boundedAnalysis,boundedSummary]=ai.calls.map(call=>call.body)
  assert.equal(evidenceIds(boundedAnalysis).length,60);assert.equal(evidenceIds(boundedSummary).length,60);assert.equal(evidenceIds(boundedSummary)[0],`action:${oldest}`)
  assert.equal(await count('context_actions','subject_id=?',bounded.contactId),10,'unselected activity waits for a later batch')
  assert.equal(await count('context_actions','project_id!=?',p),0)
 }finally{await c.close()}
}
