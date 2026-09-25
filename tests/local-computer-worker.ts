import {Hono} from 'hono';
import {registerLocalComputerRoutes,recoverLocalResultEffects} from '../src/modules/local-computer';
import {localComputerIntegration} from '../src/edition/local-computer';
import {trainingRoutes,recoverTrainingRuns} from '../src/modules/training-runs';
import {executeTrainingRun} from '../src/modules/training-runs/runner';
const app=new Hono<any>();
app.onError((error:any,c)=>c.json({message:error.message},error.status||500));
let failNoteOnce=false,failRevisionOnce=false,failDeliveryOnce=false;
app.post('/test/fail-note-once',c=>{failNoteOnce=true;return c.json({data:true})});
app.post('/test/fail-revision-once',c=>{failRevisionOnce=true;return c.json({data:true})});
app.post('/test/fail-delivery-once',c=>{failDeliveryOnce=true;return c.json({data:true})});
const integration={...localComputerIntegration,
 recordResult:async(...args:any[])=>{if(failNoteOnce){failNoteOnce=false;throw new Error('Injected crash after result commit before note write')}return (localComputerIntegration.recordResult as any)(...args)},
 deliveryRevision:async(...args:any[])=>{if(failRevisionOnce){failRevisionOnce=false;throw new Error('Injected crash after result commit before reply delivery')}return (localComputerIntegration.deliveryRevision as any)(...args)},
 deliver:async(...args:any[])=>{if(failDeliveryOnce){failDeliveryOnce=false;throw new Error('Injected reply delivery failure')}return (localComputerIntegration.deliver as any)(...args)}};
registerLocalComputerRoutes(app,integration as any);
app.post('/test/recover-local-effects',async c=>{await recoverLocalResultEffects(c.env,integration as any);return c.json({data:true})});
app.route('/api/training',trainingRoutes);
app.post('/test/recover-training',async c=>{await recoverTrainingRuns(c.env);return c.json({data:true})});
app.post('/test/execute/:run',async c=>{let calls=0;await executeTrainingRun(c.env,c.req.param('run'),async()=>{calls++;return {output:{responses:[{response:'Refund policy is available.',evidence_ids:[]}]},usage:{cost:null}}});return c.json({calls});});
export default {fetch:app.fetch};
// Establish the exact durable state left by a process death after message admission.
app.post('/test/crash-after-admission/:job',async c=>{const b=await c.req.json();const job:any=await c.env.DB.prepare('SELECT * FROM local_jobs WHERE id=?').bind(c.req.param('job')).first();const revision=await localComputerIntegration.deliveryRevision(c.env,job.project_id,job.conversation_id);await c.env.DB.batch([c.env.DB.prepare("INSERT INTO local_events VALUES(?,?,'result',?,?)").bind(job.id,b.event_id,JSON.stringify({status:'completed',result:b.result}),new Date().toISOString()),c.env.DB.prepare("UPDATE local_jobs SET status='completed',result=? WHERE id=?").bind(JSON.stringify(b.result),job.id),c.env.DB.prepare('INSERT INTO local_result_effects(job_id,event_id,payload) VALUES(?,?,?)').bind(job.id,b.event_id,JSON.stringify(b.result)),c.env.DB.prepare("INSERT INTO local_receipts(job_id,proposal_id,kind,status,expected_revision,expected_last_message_id) VALUES(?,'legacy','reply','sending',?,?)").bind(job.id,revision,job.expected_last_message_id)]);const sent=await localComputerIntegration.deliver(c.env,{projectId:job.project_id,conversationId:job.conversation_id,operatorId:job.operator_id,requestId:'delegation:'+job.id+':legacy',expectedRevision:revision,expectedLastMessageId:job.expected_last_message_id,body:b.result.reply_draft,attachmentIds:[],resolve:true});return c.json({data:{message_id:sent.messageId,original_revision:revision}});});
