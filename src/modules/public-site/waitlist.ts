import { Hono } from 'hono'
import { getCookie,setCookie } from 'hono/cookie'
import type { AppEnv } from '../../platform/env'
import { notice } from './html'
import { sendEmail } from '../integrations/email'
export const waitlistRoutes=new Hono<AppEnv>()
export function waitlistForm(c:any,html:string){const token=crypto.randomUUID();setCookie(c,'public_waitlist_csrf',token,{httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:',path:'/waitlist',maxAge:3600});return c.html(html.replaceAll('__WAITLIST_TOKEN__',token))}
waitlistRoutes.post('/waitlist',async c=>{
 const origin=c.req.header('origin');if(origin&&origin!==new URL(c.req.url).origin)return c.html(notice('Unable to join','The form must be submitted from this site.'),403)
 if(Number(c.req.header('content-length')||0)>8192)return c.html(notice('Unable to join','The submitted form is too large.'),413)
 const body=await c.req.parseBody();if(!body._token||body._token!==getCookie(c,'public_waitlist_csrf'))return c.html(notice('Form expired','Please reopen the waitlist form and try again.'),403)
 const name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),website=String(body.url||'').trim();let url:URL
 try{url=new URL(website);if(!['https:','http:'].includes(url.protocol))throw Error()}catch{return c.html(notice('Check your website','Enter a valid HTTP or HTTPS website URL.'),422)}
 if(!name||name.length>200||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||website.length>2000)return c.html(notice('Check your details','Name, email and website URL are required.'),422)
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.req.header('cf-connecting-ip')||'local')))).map(x=>x.toString(16).padStart(2,'0')).join('')
 const entryId=crypto.randomUUID()
 const result=await c.env.DB.prepare('INSERT INTO public_waitlist(id,name,email,website_url,created_at,request_hash) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM public_waitlist WHERE request_hash=? AND created_at>?)<5 ON CONFLICT(email) DO NOTHING').bind(entryId,name,email,url.href,Date.now(),hash,hash,Date.now()-3600000).run()
 if(!result.meta.changes)return c.html(notice('Unable to join','This email is already registered or the submission limit was reached. Please try again later.'),409)
 if(typeof c.env.WAITLIST_NOTIFY_EMAIL==='string'&&c.env.EMAIL_API_KEY&&c.env.EMAIL_FROM){
  let status='uncertain'
  try{await sendEmail(c.env,{to:c.env.WAITLIST_NOTIFY_EMAIL,subject:'HappyToHelp waitlist joined',text:`${name}\n${email}\n${url.href}`,idempotencyKey:`waitlist:${entryId}`});status='sent'}catch{const delivery=await c.env.DB.prepare('SELECT state FROM email_deliveries WHERE id=?').bind(`waitlist:${entryId}`).first<{state:string}>();status=delivery?.state||'failed'}
  await c.env.DB.prepare('UPDATE public_waitlist SET notification_status=? WHERE id=?').bind(status,entryId).run()
 }
 return c.html(notice('Thank you for joining','Your details have been saved to the waitlist. We will be in touch soon.'),201)
})
