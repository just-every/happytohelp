import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { requiredString,id } from '../../platform/db'
import { sendEmail, emailConfigured } from '../integrations/email'
export const recovery=new Hono<AppEnv>()
recovery.post('/forgot-password',async c=>{
 if(!emailConfigured(c.env)||!c.env.APP_ORIGIN)throw new HTTPException(503,{message:'Password recovery email is not configured'})
 const body=await c.req.json(),email=requiredString(body.email,'email',320).toLowerCase(),now=Date.now(),key=await hashToken(`reset:${email}`)
 const recent=await c.env.DB.prepare('SELECT window_start FROM login_attempts WHERE key=?').bind(key).first<{window_start:number}>();if(recent&&recent.window_start>now-60000)throw new HTTPException(429,{message:'Please wait before requesting another reset'})
 await c.env.DB.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start').bind(key,now).run()
 const user=await c.env.DB.prepare('SELECT u.id,u.email,m.project_id,m.role FROM users u LEFT JOIN memberships m ON m.user_id=u.id WHERE lower(u.email)=? ORDER BY m.project_id LIMIT 1').bind(email).first<{id:string;email:string;project_id:string;role:string}>()
 if(user){const token=id()+id(),tokenHash=await hashToken(token);await c.env.DB.prepare("INSERT INTO identity_tokens VALUES(?,?,?,?,?,'reset',?,NULL)").bind(tokenHash,user.id,user.project_id,user.email,user.role||'operator',now+3600000).run();const url=new URL('/reset-password',String(c.env.APP_ORIGIN));url.searchParams.set('token',token);await sendEmail(c.env,{to:email,subject:'Reset your HappyToHelp password',text:`Reset your password using this link within one hour: ${url.href}\nIf you did not request this, ignore this email.`,projectId:user.project_id,idempotencyKey:`password-reset:${tokenHash}`})}
 return c.json({accepted:true})
})
