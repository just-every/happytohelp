import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env,Job } from './types';
import { id,now,lease,jobView } from './types';
import { json } from './security';
import { context,jobEvents } from './views';

export const agentSession=new Hono<Env>();
export const liveGrant="EXISTS(SELECT 1 FROM agents a JOIN agent_workspaces w ON w.agent_id=a.id WHERE a.id=jobs.agent_id AND a.revoked_at IS NULL AND w.workspace_id=jobs.workspace_id)";
export async function scopedJob(c:Context<Env>,runId:string):Promise<Job> {
  const job=await c.env.DB.prepare(`SELECT * FROM jobs WHERE id=? AND agent_id=? AND run_id=? AND ${liveGrant}`).bind(c.req.param('id'),c.get('agent').id,runId).first<Job>();
  if(!job)throw new HTTPException(404,{message:'Assignment not available to this credential and run'});return job;
}
async function connect(c:Context<Env>) {
  const workspaces=(await c.env.DB.prepare('SELECT w.id,w.name,w.path FROM workspaces w JOIN agent_workspaces a ON a.workspace_id=w.id WHERE a.agent_id=? ORDER BY w.name').bind(c.get('agent').id).all<{id:string;name:string;path:string|null}>()).results;
  return c.json({agent:{id:c.get('agent').id,name:c.get('agent').name,workspaceIds:workspaces.map(w=>w.id)},workspaces});
}
agentSession.get('/connect',connect);
agentSession.post('/connect',async c=>{await json(c,z.object({sessionId:z.string().min(1).max(200),capabilities:z.array(z.string().max(100)).max(30).optional(),workspaceFolders:z.array(z.string().max(2000)).max(30).optional()}));return connect(c);});
agentSession.post('/claim',async c=>{
  const data=await json(c,z.object({sessionId:z.string().min(1).max(200)}));const agentId=c.get('agent').id;
  // A repeated claim is a recovery of this session's active run, never a second assignment.
  let job=await c.env.DB.prepare(`UPDATE jobs SET lease_expires_at=?,updated_at=? WHERE id=(SELECT id FROM jobs WHERE agent_id=? AND session_id=? AND status IN ('running','needs_input') ORDER BY created_at LIMIT 1) AND ${liveGrant} RETURNING *`).bind(lease(),now(),agentId,data.sessionId).first<Job>();
  if(!job) {
    job=await c.env.DB.prepare(`UPDATE jobs SET status='running',agent_id=?,session_id=?,run_id=?,lease_expires_at=?,updated_at=? WHERE id=(SELECT j.id FROM jobs j JOIN agent_workspaces w ON w.workspace_id=j.workspace_id JOIN agents a ON a.id=w.agent_id WHERE j.status='queued' AND a.id=? AND a.revoked_at IS NULL AND (j.assigned_agent_id IS NULL OR j.assigned_agent_id=a.id) AND NOT EXISTS(SELECT 1 FROM jobs active WHERE active.agent_id=a.id AND active.session_id=? AND active.status IN ('running','needs_input')) ORDER BY j.created_at LIMIT 1) AND status='queued' RETURNING *`).bind(agentId,data.sessionId,id(),lease(),now(),agentId,data.sessionId).first<Job>();
    // A concurrent request from this same session may have won; recover its run.
    if(!job)job=await c.env.DB.prepare(`SELECT * FROM jobs WHERE agent_id=? AND session_id=? AND status IN ('running','needs_input') AND ${liveGrant} ORDER BY created_at LIMIT 1`).bind(agentId,data.sessionId).first<Job>();
  }
  return c.json(job?{job:jobView(job),runId:job.run_id,context:await context(c.env,job)}:{job:null});
});
agentSession.get('/jobs/:id/context',async c=>{const job=await scopedJob(c,c.req.query('runId')??'');return c.json(await context(c.env,job));});
agentSession.get('/jobs/:id/check',async c=>{
  let job=await scopedJob(c,c.req.query('runId')??'');
  if(['running','needs_input'].includes(job.status)) {
    await c.env.DB.prepare(`UPDATE jobs SET lease_expires_at=? WHERE id=? AND agent_id=? AND run_id=? AND status IN ('running','needs_input') AND ${liveGrant}`).bind(lease(),job.id,c.get('agent').id,job.run_id).run();job=await scopedJob(c,job.run_id!);
  }
  return c.json({status:job.status,cancelled:job.status==='cancelled',input:(await jobEvents(c.env,job.id)).filter(e=>e.kind==='operator_input'),leaseExpiresAt:job.lease_expires_at});
});
agentSession.post('/jobs/:id/heartbeat',async c=>{
  const data=await json(c,z.object({runId:z.string().uuid()}));const job=await scopedJob(c,data.runId);
  if(!['running','needs_input'].includes(job.status))throw new HTTPException(409,{message:'Assignment no longer active'});
  const updated=await c.env.DB.prepare(`UPDATE jobs SET lease_expires_at=? WHERE id=? AND run_id=? AND agent_id=? AND status IN ('running','needs_input') AND ${liveGrant} RETURNING lease_expires_at`).bind(lease(),job.id,data.runId,c.get('agent').id).first<{lease_expires_at:string}>();
  if(!updated)throw new HTTPException(409,{message:'Assignment changed'});return c.json({ok:true,leaseExpiresAt:updated.lease_expires_at});
});
