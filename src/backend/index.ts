import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from './types';
import { auth } from './auth';
import { operatorAuth,agentAuth } from './security';
import { records } from './operator-records';
import { operatorJobs } from './operator-jobs';
import { agentSession } from './agent-session';
import { agentEvents } from './agent-events';
import { agentAttachments,operatorAttachments } from './attachments';
export type { Bindings } from './types';

export const api=new Hono<Env>();
api.use('*',async(c,next)=>{
  c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
  if(c.env.APP_ORIGIN && new URL(c.req.url).host!==new URL(c.env.APP_ORIGIN).host)return c.json({error:'Unexpected application host'},421);
  await next();
});
api.get('/health',async c=>{await c.env.DB.prepare('SELECT 1').first();return c.json({ok:true,service:'happytohelp'});});
api.route('/api',auth);
const operators=new Hono<Env>();operators.use('*',operatorAuth);operators.route('/',records);operators.route('/',operatorJobs);operators.route('/',operatorAttachments);
const agents=new Hono<Env>();agents.use('*',agentAuth);agents.route('/',agentSession);agents.route('/',agentEvents);agents.route('/',agentAttachments);
api.route('/api/agent',agents);
api.route('/api',operators);
api.notFound(c=>c.json({error:'Endpoint not found'},404));
api.onError((error,c)=>{
  if(error instanceof HTTPException)return c.json({error:error.message},error.status);
  console.error('HappyToHelp API failure',error instanceof Error?error.message:'Unknown error');
  return c.json({error:'Request failed; no successful outcome is claimed'},500);
});
