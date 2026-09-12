import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Env, Job } from './types';
import { id, now, jobView } from './types';
import { hash,json,secret,identifier,shortText } from './security';
import { requestView, jobEvents } from './views';
import type { RequestRow } from './views';

export const records=new Hono<Env>();
records.get('/workspaces',async c=>c.json({workspaces:(await c.env.DB.prepare('SELECT id,name,path,created_at AS createdAt FROM workspaces ORDER BY name').all()).results}));
records.post('/workspaces',async c=>{
  const data=await json(c,z.object({name:shortText,path:z.string().trim().max(2000).nullable().optional()}));
  const workspace={id:id(),name:data.name,path:data.path??null,createdAt:now()};
  await c.env.DB.prepare('INSERT INTO workspaces(id,name,path,created_at) VALUES(?,?,?,?)').bind(workspace.id,workspace.name,workspace.path,workspace.createdAt).run();return c.json({workspace},201);
});
records.get('/agents',async c=>{
  const rows=(await c.env.DB.prepare('SELECT id,name,revoked_at AS revokedAt,created_at AS createdAt,last_seen_at AS lastSeenAt FROM agents ORDER BY created_at DESC').all<Record<string,unknown>>()).results;
  const agents=await Promise.all(rows.map(async row=>({...row,workspaceIds:(await c.env.DB.prepare('SELECT workspace_id FROM agent_workspaces WHERE agent_id=?').bind(row.id).all<{workspace_id:string}>()).results.map(w=>w.workspace_id)})));
  return c.json({agents});
});
records.post('/agents',async c=>{
  const data=await json(c,z.object({name:shortText,workspaceIds:z.array(identifier).min(1).max(30)}));
  if(new Set(data.workspaceIds).size!==data.workspaceIds.length)throw new HTTPException(400,{message:'Duplicate workspace'});
  for(const workspaceId of data.workspaceIds)if(!await c.env.DB.prepare('SELECT id FROM workspaces WHERE id=?').bind(workspaceId).first())throw new HTTPException(400,{message:'Unknown workspace'});
  const token=secret(),agent={id:id(),name:data.name,workspaceIds:data.workspaceIds,createdAt:now()};
  await c.env.DB.batch([c.env.DB.prepare('INSERT INTO agents(id,name,token_hash,created_at) VALUES(?,?,?,?)').bind(agent.id,agent.name,await hash(token),agent.createdAt),...data.workspaceIds.map(w=>c.env.DB.prepare('INSERT INTO agent_workspaces(agent_id,workspace_id) VALUES(?,?)').bind(agent.id,w))]);
  return c.json({agent,token},201);
});
records.delete('/agents/:id',async c=>{
  const stamp=now();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE agents SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(stamp,c.req.param('id')),
    c.env.DB.prepare("INSERT INTO events(id,job_id,run_id,kind,payload_json,payload_hash,created_at) SELECT ?||id,id,run_id,'credential_revoked',?,'operator',? FROM jobs WHERE (agent_id=? OR assigned_agent_id=?) AND status IN ('queued','running','needs_input')").bind(id(),JSON.stringify({operatorId:c.get('operator').id,agentId:c.req.param('id')}),stamp,c.req.param('id'),c.req.param('id')),
    c.env.DB.prepare("UPDATE requests SET status='open',updated_at=? WHERE current_job_id IN (SELECT id FROM jobs WHERE (agent_id=? OR assigned_agent_id=?) AND status IN ('queued','running','needs_input'))").bind(stamp,c.req.param('id'),c.req.param('id')),
    c.env.DB.prepare("UPDATE jobs SET status='cancelled',updated_at=? WHERE (agent_id=? OR assigned_agent_id=?) AND status IN ('queued','running','needs_input')").bind(stamp,c.req.param('id'),c.req.param('id')),
  ]);return c.json({ok:true});
});
records.get('/requests',async c=>{
  const rows=(await c.env.DB.prepare('SELECT * FROM requests ORDER BY updated_at DESC LIMIT 200').all<RequestRow>()).results;
  return c.json({requests:rows.map(requestView)});
});
records.post('/requests',async c=>{
  const data=await json(c,z.object({workspaceId:identifier,subject:shortText,customerEmail:z.string().email().max(254),body:z.string().trim().min(1).max(20000)}));
  if(!await c.env.DB.prepare('SELECT id FROM workspaces WHERE id=?').bind(data.workspaceId).first())throw new HTTPException(400,{message:'Unknown workspace'});
  const request={id:id(),...data,customerEmail:data.customerEmail.trim().toLowerCase(),status:'open',createdAt:now(),updatedAt:now()};
  await c.env.DB.prepare('INSERT INTO requests(id,workspace_id,subject,customer_email,body,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(request.id,request.workspaceId,request.subject,request.customerEmail,request.body,request.status,request.createdAt,request.updatedAt).run();return c.json({request},201);
});
records.get('/requests/:id',async c=>{
  const row=await c.env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(c.req.param('id')).first<RequestRow>();
  if(!row)throw new HTTPException(404,{message:'Request not found'});
  const jobs=(await c.env.DB.prepare('SELECT * FROM jobs WHERE request_id=? ORDER BY created_at DESC').bind(row.id).all<Job>()).results;
  const events=(await Promise.all(jobs.map(j=>jobEvents(c.env,j.id)))).flat().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const replies=(await c.env.DB.prepare('SELECT id,job_id AS jobId,body,status,error,provider_id AS providerId,approved_at AS approvedAt,created_at AS createdAt,updated_at AS updatedAt FROM replies WHERE request_id=? ORDER BY created_at').bind(row.id).all()).results;
  return c.json({request:requestView(row),jobs:jobs.map(jobView),events,replies});
});
records.post('/requests/:id/delegate',async c=>{
  const data=await json(c,z.object({mode:z.enum(['investigate','resolve','resolve_reply']),instructions:z.string().trim().min(1).max(12000),agentId:identifier.optional()}));
  const request=await c.env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(c.req.param('id')).first<RequestRow>();
  if(!request)throw new HTTPException(404,{message:'Request not found'});
  if(request.status==='resolved')throw new HTTPException(409,{message:'Reopen request before delegating'});
  const candidate=await c.env.DB.prepare('SELECT a.id FROM agents a JOIN agent_workspaces w ON w.agent_id=a.id WHERE w.workspace_id=? AND a.revoked_at IS NULL AND (? IS NULL OR a.id=?) LIMIT 1').bind(request.workspace_id,data.agentId??null,data.agentId??null).first();
  if(!candidate)throw new HTTPException(409,{message:'Create an active scoped agent credential first'});
  const jobId=id(),stamp=now();
  try { await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO jobs(id,request_id,workspace_id,assigned_agent_id,mode,instructions,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'queued',?,?)").bind(jobId,request.id,request.workspace_id,data.agentId??null,data.mode,data.instructions,stamp,stamp),
    c.env.DB.prepare("UPDATE requests SET status='delegated',updated_at=?,current_job_id=? WHERE id=?").bind(stamp,jobId,request.id),
    c.env.DB.prepare("INSERT INTO events(id,job_id,kind,payload_json,payload_hash,created_at) VALUES(?,?,'delegated',?,?,?)").bind(id(),jobId,JSON.stringify({mode:data.mode,instructions:data.instructions,operatorId:c.get('operator').id}),'operator',stamp)
  ]); } catch(error) { if(String(error).includes('UNIQUE'))throw new HTTPException(409,{message:'Request already has an active assignment'});throw error; }
  const job=await c.env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(jobId).first<Job>();return c.json({job:jobView(job!)},201);
});
