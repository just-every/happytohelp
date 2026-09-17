import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { requiredString,id } from '../../platform/db'
import { passwordHash } from './credentials'
import { sendEmail, emailConfigured } from '../integrations/email'
export const registration=new Hono<AppEnv>()
registration.post('/register',async c=>{
 if(c.env.REGISTRATION_ENABLED!=='true'||!emailConfigured(c.env)||!c.env.APP_ORIGIN)throw new HTTPException(503,{message:'Registration email is not configured'})
 const b=await c.req.json(),email=requiredString(b.email,'email',320).toLowerCase(),name=requiredString(b.name,'name',200),projectName=requiredString(b.projectName,'projectName',200),origin=new URL(requiredString(b.allowedOrigin,'allowedOrigin')).origin
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HTTPException(400,{message:'Invalid email'})
 if(c.env.TURNSTILE_SECRET){const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:String(c.env.TURNSTILE_SECRET),response:requiredString(b.turnstileToken,'turnstileToken')})});const result=await response.json() as {success:boolean};if(!result.success)throw new HTTPException(403,{message:'Challenge verification failed'})}
 const existing=await c.env.DB.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first();if(existing)throw new HTTPException(409,{message:'Email already registered'})
 const token=id()+id(),hash=await hashToken(token);await c.env.DB.prepare('INSERT INTO registrations VALUES(?,?,?,?,?,?,?,NULL)').bind(hash,email,name,await passwordHash(b.password),projectName,origin,Date.now()+86400000).run();const url=new URL('/verify-email',String(c.env.APP_ORIGIN));url.searchParams.set('token',token)
 await sendEmail(c.env,{to:email,subject:'Verify your HappyToHelp email',text:`Verify your email and create your project using this link within 24 hours: ${url.href}`,idempotencyKey:`registration:${hash}`});return c.json({verificationRequired:true},202)
})
registration.post('/verify-email',async c=>{
 const b=await c.req.json(),hash=await hashToken(requiredString(b.token,'token')),now=Date.now(),userId=id(),projectId=id();const guard='token_hash=? AND consumed_at IS NULL AND expires_at>?'
 const row=await c.env.DB.prepare(`SELECT email FROM registrations WHERE ${guard}`).bind(hash,now).first();if(!row)throw new HTTPException(400,{message:'Verification token invalid or expired'})
 const results=await c.env.DB.batch([c.env.DB.prepare(`INSERT INTO users(id,email,name,created_at) SELECT ?,email,name,? FROM registrations WHERE ${guard}`).bind(userId,now,hash,now),c.env.DB.prepare(`INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) SELECT ?,project_name,?,allowed_origin,? FROM registrations WHERE ${guard}`).bind(projectId,id(),now,hash,now),c.env.DB.prepare(`INSERT INTO memberships SELECT ?,?,'owner' FROM registrations WHERE ${guard}`).bind(projectId,userId,hash,now),c.env.DB.prepare(`INSERT INTO credentials SELECT ?,password_hash,? FROM registrations WHERE ${guard}`).bind(userId,now,hash,now),c.env.DB.prepare(`UPDATE registrations SET consumed_at=? WHERE ${guard}`).bind(now,hash,now)]);if(!results[4].meta.changes)throw new HTTPException(409,{message:'Verification already consumed'});return c.json({verified:true,projectId,loginRequired:true})
})
