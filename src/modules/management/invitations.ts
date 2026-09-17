import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {hashToken} from '../../platform/auth'
import {id,requiredString} from '../../platform/db'
import {scope} from './common'
import {sendEmail,emailConfigured} from '../integrations/email'
export const invitations=new Hono<AppEnv>()
invitations.post('/projects/:projectId/agents',async c=>{const a=await scope(c,true),b=await c.req.json(),email=requiredString(b.email||b.invitation_email,'email',320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HTTPException(400);const role=b.role||'operator';if(!['operator','admin','owner'].includes(role)||a.role!=='owner'&&role!=='operator')throw new HTTPException(403);const member=await c.env.DB.prepare('SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=?').bind(a.projectId,email).first();if(member)throw new HTTPException(409,{message:'Already a project member'});const token=id()+id();await c.env.DB.prepare("INSERT INTO identity_tokens VALUES(?,NULL,?,?,?,'invite',?,NULL)").bind(await hashToken(token),a.projectId,email,role,Date.now()+86400000).run();const invitationUrl=new URL('/accept-invitation',c.req.url);invitationUrl.searchParams.set('token',token);let delivery='not_configured';if(emailConfigured(c.env)){await sendEmail(c.env,{to:email,subject:'HappyToHelp project invitation',text:`Accept your invitation: ${invitationUrl.href}`,projectId:a.projectId,idempotencyKey:`invite:${await hashToken(token)}`});delivery='sent'}return c.json({data:{email,role,invitationUrl:invitationUrl.href,expiresIn:86400,delivery}},201)})
