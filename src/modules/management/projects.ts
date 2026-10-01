import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { requireActor } from '../../platform/auth'
import { id,requiredString,serverSecret } from '../../platform/db'
import { clientAddress,enforceRateLimits } from '../../platform/rate-limits'
import {person} from './dashboard-data'
import {artworkUrl} from './workspace-artwork'
import {scope,text,url,decode} from './common'
import {isPlatformAdmin} from './admin'
export const projects=new Hono<AppEnv>()
projects.get('/bootstrap',async c=>{const actor=await requireActor(c);if(!actor.projectId){if(actor.role==='contact')throw new HTTPException(403);return c.json({currentAgent:person(await c.env.DB.prepare('SELECT id,name,email FROM users WHERE id=?').bind(actor.id).first()),projects:{},project:null,agents:[],ais:[],plugins:[],accountOnly:true,sessionProjectId:null,isPlatformAdmin:await isPlatformAdmin(c.env.DB,actor.id)})}const a=await scope(c),rows=(await c.env.DB.prepare('SELECT p.id,p.name,p.widget_key,p.allowed_origin,p.created_at,ps.settings_json,m.role,coalesce(pref.is_primary,0) is_primary FROM projects p LEFT JOIN project_settings ps ON ps.project_id=p.id JOIN memberships m ON m.project_id=p.id LEFT JOIN user_project_preferences pref ON pref.project_id=p.id AND pref.user_id=m.user_id WHERE m.user_id=?').bind(a.id).all()).results;const map:Record<string,any>={};for(const p of rows){const agents=(await c.env.DB.prepare('SELECT u.id,u.name,u.email,m.role,s.avatar_url FROM users u JOIN memberships m ON m.user_id=u.id LEFT JOIN user_settings s ON s.user_id=u.id WHERE m.project_id=?').bind(p.id).all()).results;const ais=(await c.env.DB.prepare('SELECT * FROM ai_profiles WHERE project_id=?').bind(p.id).all()).results;const plugins=(await c.env.DB.prepare('SELECT * FROM plugins WHERE project_id=? ORDER BY sort_order,id').bind(p.id).all()).results;const {settings_json,...summary}=p;const appearance=JSON.parse(String(settings_json||'{}'));map[String(p.id)]={...summary,is_demo:appearance.is_demo===true,sidebar_artwork_url:artworkUrl(String(p.id),appearance.sidebar_artwork_id),sidebar_artwork_enabled:appearance.sidebar_artwork_enabled===true,primary_color:appearance.primary_color||null,display_mode:appearance.display_mode||null,brand_image_url:appearance.brand_image_url||null,avatar_url:appearance.avatar_url||null,agents,ais,plugins}}const project=map[a.projectId];return c.json({currentAgent:person(await c.env.DB.prepare('SELECT u.id,u.name,u.email,s.avatar_url FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=?').bind(a.id).first()),projects:map,project,sessionProjectId:actor.projectId,isPlatformAdmin:await isPlatformAdmin(c.env.DB,a.id),agents:project.agents.map(person),ais:project.ais,plugins:project.plugins})})
projects.get('/projects',async c=>{const a=await scope(c);return c.json({data:(await c.env.DB.prepare('SELECT p.id,p.name,p.widget_key,p.allowed_origin,p.created_at,m.role,coalesce(pref.is_primary,0) is_primary FROM projects p JOIN memberships m ON m.project_id=p.id LEFT JOIN user_project_preferences pref ON pref.project_id=p.id AND pref.user_id=m.user_id WHERE m.user_id=?').bind(a.id).all()).results})})
projects.post('/projects',async c=>{const a=await requireActor(c);if(a.role==='contact')throw new HTTPException(403);await enforceRateLimits(c.env,[['projectsPerAccountDay',a.id],['projectsPerIpDay',clientAddress(c.req)]]);const b=await c.req.json(),projectId=id(),name=requiredString(b.name,'name',200),origin=new URL(url(b.allowed_origin||b.allowedOrigin)).origin;await c.env.DB.batch([c.env.DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at,verification_secret) VALUES(?,?,?,?,?,?)').bind(projectId,name,id(),origin,Date.now(),serverSecret()),c.env.DB.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(projectId,a.id)]);return c.json({id:projectId,name,allowed_origin:origin},201)})
projects.get('/projects/:projectId/settings',async c=>{const a=await scope(c);return c.json({data:decode(await c.env.DB.prepare('SELECT p.id,p.name,p.widget_key,p.allowed_origin,p.created_at,s.settings_json FROM projects p LEFT JOIN project_settings s ON s.project_id=p.id WHERE p.id=?').bind(a.projectId).first())})})
projects.put('/projects/:projectId/settings',async c=>{const a=await scope(c,true),b=await c.req.json(),existing=await c.env.DB.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(a.projectId).first<{settings_json:string}>(),settings=JSON.parse(existing?.settings_json||'{}');if('display_mode' in b){if(!['balanced','light','dark'].includes(b.display_mode))throw new HTTPException(400,{message:'Invalid display mode'});settings.display_mode=b.display_mode}for(const key of ['brand_name','welcome_message','color','language','timezone','widget_position','avatar_url','default_responder','website','notification_email','help_center_domain','primary_color','logo_url','brand_image_url','unavailable_message'])if(key in b)settings[key]=text(b[key]);for(const key of ['sidebar_artwork_enabled','is_enabled','collect_email','collector_enabled','disable_bots','is_contact_tracking_enabled','is_human_response_enabled','is_available'])if(key in b)settings[key]=Boolean(b[key]);const statements=[c.env.DB.prepare('INSERT INTO project_settings VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at').bind(a.projectId,JSON.stringify(settings),Date.now())];if(b.name)statements.push(c.env.DB.prepare('UPDATE projects SET name=? WHERE id=?').bind(requiredString(b.name,'name',200),a.projectId));if(b.allowed_origin)statements.push(c.env.DB.prepare('UPDATE projects SET allowed_origin=? WHERE id=?').bind(new URL(url(b.allowed_origin)).origin,a.projectId));await c.env.DB.batch(statements);return c.json({data:settings})})
projects.get('/profile',async c=>{const a=await scope(c);return c.json({data:await c.env.DB.prepare('SELECT u.id,u.name,u.email,u.created_at,s.timezone,s.avatar_url,s.is_notifiable_on_conversation_assignment FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=?').bind(a.id).first()})})
projects.put('/profile',async c=>{const a=await scope(c),b=await c.req.json(),old=await c.env.DB.prepare('SELECT * FROM user_settings WHERE user_id=?').bind(a.id).first<any>();const name=requiredString(b.name,'name',200),timezone=b.timezone?text(b.timezone,100):old?.timezone||'UTC';try{new Intl.DateTimeFormat('en',{timeZone:timezone})}catch{throw new HTTPException(400,{message:'Invalid timezone'})}const email=b.email?requiredString(b.email,'email',320).toLowerCase():null;if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HTTPException(400,{message:'Invalid email'});if(email&&await c.env.DB.prepare('SELECT id FROM users WHERE lower(email)=? AND id<>?').bind(email,a.id).first())throw new HTTPException(409,{message:'Email is already registered'});const statements=[c.env.DB.prepare('UPDATE users SET name=?,email=coalesce(?,email) WHERE id=?').bind(name,email,a.id),c.env.DB.prepare('INSERT INTO user_settings(user_id,timezone,avatar_url,is_notifiable_on_conversation_assignment) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET timezone=excluded.timezone,avatar_url=excluded.avatar_url,is_notifiable_on_conversation_assignment=excluded.is_notifiable_on_conversation_assignment').bind(a.id,timezone,b.avatar_url?url(b.avatar_url):old?.avatar_url||null,'is_notifiable_on_conversation_assignment' in b?(b.is_notifiable_on_conversation_assignment?1:0):old?.is_notifiable_on_conversation_assignment??1)];await c.env.DB.batch(statements);return c.json({data:{id:a.id,name,timezone}})})
projects.delete('/projects/:projectId',async c=>{
 const a=await scope(c,true)
 if(a.role!=='owner')throw new HTTPException(403)
 const now=Date.now()
 const archiveSettings=c.env.DB.prepare(`
   INSERT INTO project_settings(project_id,settings_json,updated_at)
   SELECT
     ?,
     json_set(
       coalesce((SELECT settings_json FROM project_settings WHERE project_id=?),'{}'),
       '$.retired_inbound_address',
       coalesce(
         (SELECT inbound_address FROM email_settings WHERE project_id=?),
         json_extract(coalesce((SELECT settings_json FROM project_settings WHERE project_id=?),'{}'),'$.retired_inbound_address')
       ),
       '$.mailbox_archived_at',?,
       '$.deleted_at',?
     ),
     ?
   ON CONFLICT(project_id) DO UPDATE SET
     settings_json=excluded.settings_json,
     updated_at=excluded.updated_at
 `).bind(a.projectId,a.projectId,a.projectId,a.projectId,now,now,now)
 await c.env.DB.batch([
  archiveSettings,
  c.env.DB.prepare('UPDATE email_settings SET inbound_address=NULL,is_enabled=0,updated_at=? WHERE project_id=?').bind(now,a.projectId),
  c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE project_id=?').bind(now,a.projectId),
  c.env.DB.prepare('DELETE FROM memberships WHERE project_id=?').bind(a.projectId),
  c.env.DB.prepare("UPDATE contacts SET metadata_json=json_set(metadata_json,'$.is_blocked',1) WHERE project_id=?").bind(a.projectId),
  c.env.DB.prepare('UPDATE projects SET widget_key=?,allowed_origin=? WHERE id=?').bind(id(),'https://deleted.invalid',a.projectId),
  c.env.DB.prepare("UPDATE ai_profiles SET is_enabled=0 WHERE project_id=?").bind(a.projectId),
  c.env.DB.prepare("UPDATE ai_generations SET state='cancelled',updated_at=? WHERE project_id=? AND state='queued'").bind(new Date().toISOString(),a.projectId)
 ])
 return c.json({deleted:true,retainedHistory:true})
})
