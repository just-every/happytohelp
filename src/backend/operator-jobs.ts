import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Env,Job } from './types';
import { id,now } from './types';
import { json } from './security';
import { dispatchReply,resolveAcceptedReply,currentReply } from './mail';

export const operatorJobs=new Hono<Env>();
operatorJobs.post('/jobs/:id/input',async c=>{
  const data=await json(c,z.object({message:z.string().trim().min(1).max(12000)}));const stamp=now();
  const eventId=id();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,id,run_id,'operator_input',?,'operator',? FROM jobs WHERE id=? AND status='needs_input'").bind(eventId,JSON.stringify({message:data.message,operatorId:c.get('operator').id}),stamp,c.req.param('id')),
    c.env.DB.prepare("UPDATE jobs SET status='running',updated_at=? WHERE id=? AND status='needs_input' AND EXISTS(SELECT 1 FROM events WHERE id=?)").bind(stamp,c.req.param('id'),eventId)
  ]);
  if(!await c.env.DB.prepare('SELECT id FROM events WHERE id=?').bind(eventId).first())throw new HTTPException(409,{message:'Assignment is not awaiting input'});
  return c.json({ok:true});
});
operatorJobs.post('/jobs/:id/cancel',async c=>{
  const stamp=now(),eventId=id();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,id,run_id,'cancelled',?,'operator',? FROM jobs WHERE id=? AND status IN ('queued','running','needs_input')").bind(eventId,JSON.stringify({operatorId:c.get('operator').id}),stamp,c.req.param('id')),
    c.env.DB.prepare("UPDATE jobs SET status='cancelled',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM events WHERE id=?)").bind(stamp,c.req.param('id'),eventId),
    c.env.DB.prepare("UPDATE requests SET status='open',updated_at=? WHERE id=(SELECT request_id FROM jobs WHERE id=?) AND current_job_id=(SELECT job_id FROM events WHERE id=?) AND EXISTS(SELECT 1 FROM events WHERE id=?)").bind(stamp,c.req.param('id'),eventId,eventId)
  ]);return c.json({ok:true});
});
operatorJobs.post('/jobs/:id/review',async c=>{
  const data=await json(c,z.object({action:z.enum(['resolve','approve_reply','reopen']),reply:z.string().trim().min(1).max(20000).optional(),replyId:z.string().uuid().optional()}));
  const job=await c.env.DB.prepare('SELECT j.* FROM jobs j JOIN requests q ON q.current_job_id=j.id WHERE j.id=?').bind(c.req.param('id')).first<Job>();
  if(!job)throw new HTTPException(409,{message:'Assignment is no longer current'});
  if(['queued','running','needs_input'].includes(job.status))throw new HTTPException(409,{message:'Wait for result or cancel active assignment first'});
  if(data.action!=='reopen'&&(job.status!=='completed'||!job.result_json||JSON.parse(job.result_json).verified!==true))throw new HTTPException(409,{message:'A verified completed result is required before resolution or reply approval'});
  const stamp=now(),eventId=id();
  if(data.action==='approve_reply') {
    if(!data.reply||!data.replyId)throw new HTTPException(400,{message:'Explicit reply text and proposal ID required'});
    const proposal=await c.env.DB.prepare(`SELECT id,body,status FROM replies WHERE id=? AND job_id=? AND ${currentReply}`).bind(data.replyId,job.id).first<{id:string;body:string;status:string}>();
    if(!proposal)throw new HTTPException(409,{message:'Reply proposal is no longer current'});
    if(proposal.status!=='proposed') {
      if(proposal.body!==data.reply)throw new HTTPException(409,{message:'Approved reply cannot be edited'});
      return c.json({ok:true,replyId:proposal.id,duplicate:true});
    }
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,?,?, 'operator_review',?,'operator',? WHERE EXISTS(SELECT 1 FROM replies WHERE id=? AND job_id=? AND status='proposed' AND ${currentReply})`).bind(eventId,job.id,job.run_id,JSON.stringify({...data,operatorId:c.get('operator').id}),stamp,proposal.id,job.id),
      c.env.DB.prepare("UPDATE replies SET body=?,status='approved',approved_at=?,updated_at=? WHERE id=? AND job_id=? AND status='proposed' AND EXISTS(SELECT 1 FROM events WHERE id=?)").bind(data.reply,stamp,stamp,proposal.id,job.id,eventId)
    ]);
    const winner=await c.env.DB.prepare(`SELECT body,status FROM replies WHERE id=? AND ${currentReply}`).bind(proposal.id).first<{body:string;status:string}>();
    if(!winner||winner.status==='proposed'||winner.body!==data.reply)throw new HTTPException(409,{message:'Another review changed this reply; reload the approved content'});
    await dispatchReply(c.env,proposal.id);return c.json({ok:true,replyId:proposal.id});
  }
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,?,?, 'operator_review',?,'operator',? WHERE EXISTS(SELECT 1 FROM requests WHERE id=? AND current_job_id=?)").bind(eventId,job.id,job.run_id,JSON.stringify({...data,operatorId:c.get('operator').id}),stamp,job.request_id,job.id),
    c.env.DB.prepare('UPDATE requests SET status=?,updated_at=? WHERE id=? AND current_job_id=? AND EXISTS(SELECT 1 FROM events WHERE id=?)').bind(data.action==='resolve'?'resolved':'open',stamp,job.request_id,job.id,eventId)
  ]);
  if(!await c.env.DB.prepare('SELECT id FROM events WHERE id=?').bind(eventId).first())throw new HTTPException(409,{message:'A newer assignment replaced this review'});
  return c.json({ok:true});
});
operatorJobs.post('/replies/:id/send',async c=>{
  const row=await c.env.DB.prepare(`SELECT status FROM replies WHERE id=? AND ${currentReply}`).bind(c.req.param('id')).first<{status:string}>();
  if(!row||!['approved','failed'].includes(row.status))throw new HTTPException(409,{message:'Reply is not eligible for submission; check current assignment and reconcile unknown outcomes'});
  await c.env.DB.prepare(`UPDATE replies SET status='approved',updated_at=? WHERE id=? AND status='failed' AND ${currentReply}`).bind(now(),c.req.param('id')).run();
  await dispatchReply(c.env,c.req.param('id'));return c.json({ok:true});
});
operatorJobs.post('/replies/:id/reconcile',async c=>{
  const data=await json(c,z.object({outcome:z.enum(['accepted','failed']),evidence:z.string().trim().min(10).max(8000),providerId:z.string().trim().max(500).optional()}));
  if(data.outcome==='accepted'&&!data.providerId)throw new HTTPException(400,{message:'Provider receipt ID required for accepted outcome'});
  const row=await c.env.DB.prepare('SELECT job_id,status,attempt_id,submission_expires_at FROM replies WHERE id=?').bind(c.req.param('id')).first<{job_id:string;status:string;attempt_id:string|null;submission_expires_at:string|null}>();
  const stamp=now(),eventId=id();
  if(!row||!['sending','uncertain'].includes(row.status))throw new HTTPException(409,{message:'Only uncertain submissions require reconciliation'});
  if(row.status==='sending'&&(!row.submission_expires_at||row.submission_expires_at>stamp))throw new HTTPException(409,{message:'Submission is still in flight; wait for its lease to expire before reconciling'});
  const eligible="status='uncertain' OR (status='sending' AND submission_expires_at<=?)";
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO events(id,job_id,kind,payload_json,payload_hash,created_at) SELECT ?,job_id,'reply_reconciled',?,'operator',? FROM replies WHERE id=? AND attempt_id IS ? AND (${eligible})`).bind(eventId,JSON.stringify({...data,replyId:c.req.param('id'),attemptId:row.attempt_id,operatorId:c.get('operator').id}),stamp,c.req.param('id'),row.attempt_id,stamp),
    c.env.DB.prepare("UPDATE replies SET status=?,provider_id=?,error=?,updated_at=? WHERE id=? AND attempt_id IS ? AND EXISTS(SELECT 1 FROM events WHERE id=?)").bind(data.outcome,data.providerId??null,data.evidence,stamp,c.req.param('id'),row.attempt_id,eventId)
  ]);
  if(!await c.env.DB.prepare('SELECT id FROM events WHERE id=?').bind(eventId).first())throw new HTTPException(409,{message:'Provider outcome changed during reconciliation; reload its receipt'});
  if(data.outcome==='accepted')await resolveAcceptedReply(c.env,c.req.param('id'));return c.json({ok:true});
});
