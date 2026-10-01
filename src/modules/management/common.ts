import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { requireActor } from '../../platform/auth'
export async function scope(c:Context<AppEnv>,admin=false){const actor=await requireActor(c);if(actor.role==='contact')throw new HTTPException(403);const project=c.req.param('projectId')||c.req.query('projectId')||actor.projectId;const member=await c.env.DB.prepare('SELECT role FROM memberships WHERE project_id=? AND user_id=?').bind(project,actor.id).first<{role:string}>();if(!member)throw new HTTPException(403,{message:'Project not found, or you do not have access to it'});if(admin&&!['admin','owner'].includes(member.role))throw new HTTPException(403,{message:'Project owner or admin role required'});return {...actor,projectId:project,role:member.role}}
export function text(value:unknown,max=2000){if(typeof value!=='string'||value.length>max)throw new HTTPException(400,{message:'Invalid text'});return value.trim()}
export function url(value:unknown){const result=new URL(text(value));if(result.protocol!=='https:'&&!(result.protocol==='http:'&&['localhost','127.0.0.1'].includes(result.hostname)))throw new HTTPException(400,{message:'HTTPS URL required'});return result.href}
export const decode=(row:any)=>row?{...row,...JSON.parse(row.settings_json||'{}')}:row
