import { sendSendGrid, SendGridSendError } from '../modules/sendgrid-email/sender';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from './types';
import { id,now } from './types';

export const currentReply = "EXISTS(SELECT 1 FROM jobs j JOIN requests q ON q.id=j.request_id WHERE j.id=replies.job_id AND q.current_job_id=j.id AND q.status IN ('review','resolved') AND j.status='completed' AND json_extract(j.result_json,'$.verified')=1)";

/** Claim once before IO; the attempt identity prevents a late receipt settling another submission. */
export async function dispatchReply(env: Bindings, replyId: string): Promise<void> {
  if (!await env.DB.prepare(`SELECT id FROM replies WHERE id=? AND ${currentReply}`).bind(replyId).first()) throw new HTTPException(409,{message:'Reply belongs to a superseded or reopened assignment'});
  if (!env.SENDGRID_API_KEY || !env.MAIL_FROM) {
    await env.DB.prepare(`UPDATE replies SET error='Configure SENDGRID_API_KEY and MAIL_FROM before sending',updated_at=? WHERE id=? AND status='approved' AND ${currentReply}`).bind(now(),replyId).run();return;
  }
  const attemptId=id(),expiresAt=new Date(Date.now()+30_000).toISOString();
  const reply=await env.DB.prepare(`UPDATE replies SET status='sending',error=NULL,attempt_id=?,submission_expires_at=?,updated_at=? WHERE id=? AND status='approved' AND ${currentReply} RETURNING id,request_id,job_id,body`).bind(attemptId,expiresAt,now(),replyId).first<{id:string;request_id:string;job_id:string;body:string}>();
  if(!reply)return;
  const request=await env.DB.prepare('SELECT customer_email,subject FROM requests WHERE id=?').bind(reply.request_id).first<{customer_email:string;subject:string}>();
  if(!request)throw new Error('Reply request is missing');
  let outcome:'accepted'|'failed'|'uncertain',providerId:string|null=null,failure:string|null=null;
  try {
    const receipt=await sendSendGrid({apiKey:env.SENDGRID_API_KEY,message:{from:env.MAIL_FROM,to:[request.customer_email],subject:`Re: ${request.subject}`,text:reply.body,deliveryId:attemptId}});
    outcome='accepted';providerId=receipt.providerMessageId;
  } catch(error) {
    outcome=error instanceof SendGridSendError && error.outcome!=='ambiguous'?'failed':'uncertain';
    failure=error instanceof Error?error.message:'Provider outcome uncertain';
  }
  // Always retain observed provider evidence, even if manual reconciliation won.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO events(id,job_id,kind,payload_json,payload_hash,created_at) VALUES(?,?,'provider_receipt',?,'provider',?)").bind(id(),reply.job_id,JSON.stringify({replyId,attemptId,outcome,providerId,error:failure}),now()),
    env.DB.prepare("UPDATE replies SET status=?,provider_id=?,error=?,updated_at=? WHERE id=? AND status='sending' AND attempt_id=?").bind(outcome,providerId,failure,now(),replyId,attemptId)
  ]);
  if(outcome==='accepted')await resolveAcceptedReply(env,replyId);
}

/** Only the current assignment's recorded receipt can resolve its request. */
export async function resolveAcceptedReply(env: Bindings,replyId:string):Promise<void> {
  const stamp=now(),eventId=id();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?,j.id,j.run_id,'resolved_after_reply',?,'delivery',? FROM jobs j JOIN replies r ON r.job_id=j.id JOIN requests q ON q.id=j.request_id WHERE r.id=? AND r.status='accepted' AND j.mode='resolve_reply' AND j.status='completed' AND json_extract(j.result_json,'$.verified')=1 AND q.status='review' AND q.current_job_id=j.id").bind(eventId,JSON.stringify({replyId}),stamp,replyId),
    env.DB.prepare("UPDATE requests SET status='resolved',updated_at=? WHERE id=(SELECT request_id FROM replies WHERE id=?) AND current_job_id=(SELECT job_id FROM replies WHERE id=?) AND status='review' AND EXISTS(SELECT 1 FROM events WHERE id=?)").bind(stamp,replyId,replyId,eventId)
  ]);
}
