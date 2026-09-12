import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from './types';
import { id,now } from './types';
import { hash,json } from './security';
import { scopedJob,liveGrant } from './agent-session';
import { dispatchReply } from './mail';

export const agentEvents=new Hono<Env>();
const attachmentIds=z.array(z.string().uuid()).max(10);
const resultSchema=z.object({
  summary:z.string().trim().min(1).max(16000), verified:z.boolean(),
  actions:z.array(z.object({description:z.string().trim().min(1).max(4000),evidence:z.string().trim().min(1).max(8000)})).max(50).default([]),
  question:z.string().trim().min(1).max(4000).nullable().optional(),
  reply_draft:z.string().trim().min(1).max(20000).optional(),
  replies:z.array(z.object({id:z.string().max(200),title:z.string().max(500),body:z.string().trim().min(1).max(20000),attachment_ids:attachmentIds.optional()})).max(10).optional(),
  follow_up_actions:z.array(z.object({id:z.string().max(200),title:z.string().max(500),instructions:z.string().max(12000),mode:z.enum(['investigate','resolve','resolve_reply']),attachment_ids:attachmentIds.optional()})).max(10).optional(),
  attachment_ids:attachmentIds.optional(),
});
async function existingReceipt(c:Context<Env>, eventId:string, payloadHash:string) {
  const existing=await c.env.DB.prepare('SELECT job_id,payload_hash FROM events WHERE id=?').bind(eventId).first<{job_id:string;payload_hash:string}>();
  if(!existing)return null;
  if(existing.job_id!==c.req.param('id')||existing.payload_hash!==payloadHash)throw new HTTPException(409,{message:'Event ID already used for different content'});
  return {ok:true,eventId,duplicate:true};
}
agentEvents.post('/jobs/:id/progress',async c=>{
  const data=await json(c,z.object({runId:z.string().uuid(),eventId:z.string().uuid(),message:z.string().trim().min(1).max(8000)}));
  await scopedJob(c,data.runId);const digest=await hash(JSON.stringify(data));
  const previous=await existingReceipt(c,data.eventId,digest);if(previous)return c.json(previous);
  try {
    const row=await c.env.DB.prepare(`INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,id,run_id,'progress',?,?,? FROM jobs WHERE id=? AND agent_id=? AND run_id=? AND status='running' AND lease_expires_at>? AND ${liveGrant} RETURNING id`).bind(data.eventId,JSON.stringify({message:data.message}),digest,now(),c.req.param('id'),c.get('agent').id,data.runId,now()).first();
    if(!row)throw new HTTPException(409,{message:'Assignment not active; check current context'});
  } catch(error) {const duplicate=await existingReceipt(c,data.eventId,digest);if(duplicate)return c.json(duplicate);throw error;}
  return c.json({ok:true,eventId:data.eventId,duplicate:false});
});
agentEvents.post('/jobs/:id/result',async c=>{
  const data=await json(c,z.object({runId:z.string().uuid(),eventId:z.string().uuid(),status:z.enum(['completed','needs_input','failed','cancelled']),result:resultSchema}));
  const job=await scopedJob(c,data.runId),digest=await hash(JSON.stringify(data));
  const previous=await existingReceipt(c,data.eventId,digest);if(previous)return c.json(previous);
  if(data.status==='completed'&&!data.result.verified)throw new HTTPException(400,{message:'Completed results require verification'});
  if(data.status==='needs_input'&&(!data.result.question||data.result.verified))throw new HTTPException(400,{message:'Needs input requires an unanswered question and verified=false'});
  if(data.status!=='completed'&&data.result.verified)throw new HTTPException(400,{message:'Unfinished work cannot be verified completed'});
  if(job.mode==='resolve_reply'&&data.result.replies!==undefined)throw new HTTPException(400,{message:'Resolve and reply uses reply_draft; omit replies'});
  if(job.mode!=='resolve_reply'&&data.result.reply_draft)throw new HTTPException(400,{message:'Reply draft requires resolve_reply authorization; use proposals'});
  if(job.mode==='resolve_reply'&&data.status==='completed'&&!data.result.reply_draft)throw new HTTPException(400,{message:'Verified resolve_reply completion requires one reply_draft'});
  const allIds=[...(data.result.attachment_ids??[]),...(data.result.replies??[]).flatMap(r=>r.attachment_ids??[]),...(data.result.follow_up_actions??[]).flatMap(r=>r.attachment_ids??[])];
  if(new Set(allIds).size>30)throw new HTTPException(400,{message:'Too many distinct attachments'});
  for(const attachmentId of new Set(allIds))if(!await c.env.DB.prepare('SELECT id FROM attachments WHERE id=? AND job_id=? AND run_id=? AND agent_id=?').bind(attachmentId,job.id,data.runId,c.get('agent').id).first())throw new HTTPException(400,{message:'Attachment is not owned by this job and run'});
  const stamp=now(),replyId=id();const statements=[
    c.env.DB.prepare(`INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,id,run_id,?,?,?,? FROM jobs WHERE id=? AND agent_id=? AND run_id=? AND status='running' AND lease_expires_at>? AND ${liveGrant}`).bind(data.eventId,data.status,JSON.stringify(data.result),digest,stamp,job.id,c.get('agent').id,data.runId,stamp),
    c.env.DB.prepare('UPDATE jobs SET status=?,result_json=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM events WHERE id=? AND payload_hash=?)').bind(data.status,JSON.stringify(data.result),stamp,job.id,data.eventId,digest),
    c.env.DB.prepare('UPDATE requests SET status=?,updated_at=? WHERE id=? AND current_job_id=? AND EXISTS(SELECT 1 FROM events WHERE id=? AND payload_hash=?)').bind(data.status==='needs_input'?'needs_input':data.status==='completed'?'review':'open',stamp,job.request_id,job.id,data.eventId,digest),
  ];
  if(data.status==='completed'&&job.mode==='resolve_reply')statements.push(c.env.DB.prepare("INSERT INTO replies(id,request_id,job_id,body,status,approved_at,created_at,updated_at) SELECT ?,?,?,?,'approved',?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND payload_hash=?)").bind(replyId,job.request_id,job.id,data.result.reply_draft!,stamp,stamp,stamp,data.eventId,digest));
  if(data.status==='completed'&&job.mode!=='resolve_reply')for(const reply of data.result.replies??[])statements.push(c.env.DB.prepare("INSERT INTO replies(id,request_id,job_id,body,status,created_at,updated_at) SELECT ?,?,?,?,'proposed',?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND payload_hash=?)").bind(id(),job.request_id,job.id,reply.body,stamp,stamp,data.eventId,digest));
  try {await c.env.DB.batch(statements);}catch(error){const duplicate=await existingReceipt(c,data.eventId,digest);if(duplicate)return c.json(duplicate);throw error;}
  if(!await existingReceipt(c,data.eventId,digest))throw new HTTPException(409,{message:'Assignment no longer active; check current context'});
  if(data.status==='completed'&&job.mode==='resolve_reply')await dispatchReply(c.env,replyId);
  return c.json({ok:true,eventId:data.eventId,duplicate:false});
});
