import {handleContextWidgetAction} from '../../src/modules/customer-context/widget'
import {collectActions,trackEvents} from '../../src/modules/customer-context/collector'
import {enqueueContextJob,recoverContextJobs} from '../../src/modules/customer-context/jobs'
import {consumeContextJob} from '../../src/modules/customer-context/engine'
import {readContextSource,monitoringPacket} from '../../src/modules/customer-context/packets'
import {requestContextModel} from '../../src/edition/ai/customer-context-provider'
const assert=(value:any,message:string)=>{if(!value)throw new Error(message)}
export default {async fetch(request:Request,env:any){try{
 const queued:any[]=[];env={...env,JOBS:{send:async(job:any)=>{queued.push(job)}}}
 const subject='s';await env.DB.prepare("INSERT INTO projects VALUES('p','Project','key','https://example.test',1)").run()
 await env.DB.prepare("INSERT INTO context_subjects(project_id,subject_id,consent,help_types) VALUES('p',?,1,'[\"support\"]')").bind(subject).run()
 const idle=await collectActions(env,'p',subject,[{localId:'idle',action:'Detected extended inactivity (120 seconds without interaction) - User may be hesitating.'}]);assert(idle.accepted===0,'idle no-op')
 await collectActions(env,'p',subject,Array.from({length:7},(_,i)=>({localId:`a${i}`,action:`Password reset failed step ${i}`})))
 await collectActions(env,'p',subject,[{localId:'a0',action:'duplicate'}])
 assert((await env.DB.prepare('SELECT actions_count FROM context_collectors').first()).actions_count===7,'duplicate action count')
 const raced=await Promise.all([enqueueContextJob(env,'p',subject,'monitoring','gpt-5.4-nano'),enqueueContextJob(env,'p',subject,'monitoring','gpt-5.4-nano')]);assert(raced.filter(r=>r.id).length===1,'single admission')
 let calls=0
 const noInsight=async(_env:any,_job:any,task:string,req:any)=>{calls++;return task==='summary'?{summary:'Seven password reset failures were observed.'}:{decision:'no_insight',help_type:null,evidence_ids:[],help:null}}
 await Promise.all([consumeContextJob(queued[0],env,noInsight),consumeContextJob(queued[0],env,noInsight)])
 assert(calls===2,'duplicate delivery did not repeat analysis/summary')
 assert((await env.DB.prepare('SELECT count(*) n FROM context_insights').first()).n===0,'no fabricated insight')
 assert((await env.DB.prepare('SELECT count(*) n FROM context_actions').first()).n===0,'exact summary compaction')
 assert((await env.DB.prepare('SELECT count(*) n FROM context_summaries').first()).n===1,'summary persisted')
 const packet=monitoringPacket(await readContextSource(env,'p',subject));assert(packet.historical_summaries.length===1,'historical summary packet')
 await env.DB.prepare("UPDATE context_collectors SET last_run_at=0 WHERE project_id='p'").run()
 await collectActions(env,'p',subject,Array.from({length:8},(_,i)=>({localId:`b${i}`,action:`Payment declined ${i}`})))
 const offered=await enqueueContextJob(env,'p',subject,'monitoring','gpt-5.4-nano')
 const insightProvider=async(_env:any,job:any,task:string,req:any)=>{const p=JSON.parse(job.packet_json).packet;return task==='analysis'?{decision:'insight',help_type:'support',evidence_ids:[p.eligible_evidence_ids[0]],help:'Help with payment'}:task==='insight'?{content:'Would you like help?',buttons:[{text:'Dismiss',action:'close'}],loading:null,evidence_ids:[p.eligible_evidence_ids[0]]}:{summary:'Payment errors were observed.'}}
 await consumeContextJob({type:'context.run',id:offered.id!,projectId:'p'},env,insightProvider)
 assert((await env.DB.prepare('SELECT count(*) n FROM context_insights').first()).n===1,'insight stored')
 await env.DB.prepare('UPDATE context_insights SET dismissed_at=?').bind(Date.now()).run()
 await env.DB.prepare('UPDATE context_collectors SET last_run_at=0').run()
 await collectActions(env,'p',subject,Array.from({length:8},(_,i)=>({localId:`c${i}`,action:`New issue ${i}`})))
 const dismissed=await enqueueContextJob(env,'p',subject,'monitoring','gpt-5.4-nano');calls=0
 await consumeContextJob({type:'context.run',id:dismissed.id!,projectId:'p'},env,async()=>{calls++;throw new Error('must not request')});assert(calls===0,'dismissal blocks requests')
 await env.DB.prepare("INSERT INTO context_evidence VALUES('e','p','s','customer_message','I am a developer','private',1)").run()
 const profile=await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano')
 const profileProvider=async(_env:any,job:any)=>{const packet=JSON.parse(job.packet_json).packet;return Object.fromEntries(['upcoming_events','user_type','problem','solutions_needed','job','role','risk_profile','personality'].map(key=>[key,key==='user_type'?{value:'developer',confidence:90,evidence_status:'supported',evidence_ids:[packet.evidence[0].id]}:{value:null,confidence:null,evidence_status:'unknown',evidence_ids:[]}]))}
 await consumeContextJob({type:'context.run',id:profile.id!,projectId:'p'},env,profileProvider)
 assert(JSON.parse((await env.DB.prepare("SELECT profile FROM context_profiles WHERE type='contact'").first()).profile).user_type.value==='developer','profile published')
 assert((await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano')).reason==='unchanged_evidence','fingerprint no-op')
 await env.DB.prepare("UPDATE context_evidence SET content='I am not a developer' WHERE id='e'").run()
 assert((await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano')).reason==='profile_cooldown','profile cooldown')
 await env.DB.prepare("UPDATE context_profiles SET started_at=0 WHERE type='contact'").run()
 const corrected=await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano')
 await consumeContextJob({type:'context.run',id:corrected.id!,projectId:'p'},env,async(...args:any[])=>{const result=await profileProvider(args[0],args[1]);result.user_type={value:null,confidence:null,evidence_status:'contradicted',evidence_ids:[JSON.parse(args[1].packet_json).packet.evidence[0].id]};return result})
 assert(!JSON.parse((await env.DB.prepare("SELECT profile FROM context_profiles WHERE type='contact'").first()).profile).user_type,'attributed retraction')
 await env.DB.prepare("UPDATE context_profiles SET started_at=0 WHERE type='contact'").run();await env.DB.prepare("UPDATE context_evidence SET content='New fact' WHERE id='e'").run()
 const stale=await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano')
 await consumeContextJob({type:'context.run',id:stale.id!,projectId:'p'},env,async(...args:any[])=>{await env.DB.prepare("UPDATE context_subjects SET consent=0 WHERE subject_id='s'").run();return profileProvider(args[0],args[1])})
 assert((await env.DB.prepare('SELECT state FROM context_jobs WHERE id=?').bind(stale.id).first()).state==='superseded','consent race rejected atomically')
 assert((await env.DB.prepare('SELECT count(*) n FROM context_write_guards').first()).n===0,'guards rolled back')
 await env.DB.prepare("UPDATE context_subjects SET consent=1 WHERE subject_id='s'").run();await env.DB.prepare("UPDATE context_profiles SET started_at=0 WHERE type='contact'").run()
 const uncertain=await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano');await env.DB.prepare("UPDATE context_jobs SET state='running',started_at=0,provider_started=1 WHERE id=?").bind(uncertain.id).run();await recoverContextJobs(env)
 calls=0;await consumeContextJob({type:'context.run',id:uncertain.id!,projectId:'p'},env,async()=>{calls++;throw new Error('no retry')});assert(calls===0,'unknown attempt no retry')
 assert((await enqueueContextJob(env,'p',subject,'contact','gpt-5.4-nano')).reason!=='queued','uncertain excludes new generation')
 const events=await trackEvents(env,'p',subject,[{localId:'page',type:'PAGE_VIEW',payload:{url:'/help'}},{localId:'ignored',type:'UNSUPPORTED',payload:{}}]);await trackEvents(env,'p',subject,[{localId:'page',type:'PAGE_VIEW',payload:{url:'/help'}}]);assert(events[0].count===1,'tracked count')
 const other=await collectActions(env,'other',subject,[{localId:'x',action:'cross project'}]);assert(other.accepted===0,'tenant denied')
 let missing=false;try{await requestContextModel(env,{id:'missing',project_id:'p',model:'gpt-5.6-luna'},'profile',{})}catch(e){missing=String(e).includes('CONFIGURATION_REQUIRED')}assert(missing,'unconfigured provider fails closed')
 await env.DB.prepare("INSERT INTO context_subjects(project_id,subject_id,consent,help_types) VALUES('p','bounded',1,'[\"support\"]')").run()
 await collectActions(env,'p','bounded',Array.from({length:70},(_,i)=>({localId:`bound${i}`,action:`Observed failure ${i}`})))
 const boundedSource=await readContextSource(env,'p','bounded')
 assert(monitoringPacket(boundedSource).direct_observations.length===60&&boundedSource.summaryPacket.direct_observations.length===60,'bounded separate windows')
 const oldest=(await env.DB.prepare("SELECT id FROM context_actions WHERE subject_id='bounded' ORDER BY occurred_at,id LIMIT 1").first()).id
 assert(boundedSource.summaryPacket.direct_observations[0].evidence_id===`action:${oldest}`,'summary selects oldest evidence')
 const bounded=await enqueueContextJob(env,'p','bounded','monitoring','gpt-5.4-nano')
 await consumeContextJob({type:'context.run',id:bounded.id!,projectId:'p'},env,noInsight)
 assert((await env.DB.prepare("SELECT count(*) n FROM context_actions WHERE subject_id='bounded'").first()).n===10,'summary leaves unselected rows')
 await env.DB.prepare("INSERT INTO contacts(id,project_id,created_at) VALUES('bounded','p',1)").run()
 await env.DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('conversation','p','bounded',1,1)").run()
 let denied=false;try{await handleContextWidgetAction(env,{id:'other',projectId:'p',role:'contact',contactId:'other'},'conversation','collector',[{localId:'denied',action:'Denied'}])}catch{denied=true}assert(denied,'widget denies other contact')
 return Response.json({passed:26,calls:'test-only provider fixtures; actual Worker and D1',states:(await env.DB.prepare('SELECT kind,state FROM context_jobs').all()).results})
 }catch(error){return Response.json({error:String(error),stack:(error as Error).stack},{status:500})}}}
