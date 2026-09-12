import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env, Operator } from './types';
import { id, now } from './types';
import { findOperator, hash, json, passwordHash, passwordMatches, secret } from './security';

export const auth = new Hono<Env>();
const credentials = z.object({ email: z.string().email().max(254).transform(s => s.trim().toLowerCase()), password: z.string().min(12).max(256) });
async function startSession(c: Context<Env>, operator: Operator) {
  const token = secret();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash,operator_id,expires_at) VALUES (?,?,?)').bind(await hash(token),operator.id,new Date(Date.now()+86400000).toISOString()).run();
  setCookie(c,'h2h_session',token,{ httpOnly:true, secure:new URL(c.req.url).protocol==='https:', sameSite:'Strict', path:'/', maxAge:86400 });
  return c.json({ operator });
}
function requireOrigin(c: Context<Env>) {
  if (c.req.header('origin') !== new URL(c.env.APP_ORIGIN ?? c.req.url).origin) throw new HTTPException(403,{message:'Same-origin request required'});
}
async function bootstrapRequired(c: Context<Env>) { return !(await c.env.DB.prepare('SELECT id FROM operators LIMIT 1').first()); }

auth.get('/session', async c => { const operator=await findOperator(c); return c.json({ authenticated:Boolean(operator),operator, bootstrapRequired:await bootstrapRequired(c), mailConfigured:Boolean(c.env.SENDGRID_API_KEY && c.env.MAIL_FROM) }); });
auth.post('/auth/bootstrap', async c => {
  requireOrigin(c);
  const data = await json(c,credentials.extend({name:z.string().trim().min(1).max(100),bootstrapToken:z.string().min(1).max(256)}));
  if (!c.env.H2H_BOOTSTRAP_TOKEN || await hash(data.bootstrapToken)!==await hash(c.env.H2H_BOOTSTRAP_TOKEN)) throw new HTTPException(403,{message:'Invalid bootstrap token'});
  const operator={id:id(),email:data.email,name:data.name};
  const inserted=await c.env.DB.prepare('INSERT INTO operators (id,email,name,password_hash,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM operators) RETURNING id').bind(operator.id,operator.email,operator.name,await passwordHash(data.password),now()).first();
  if (!inserted) throw new HTTPException(409,{message:'Operator already configured'});
  return startSession(c,operator);
});
auth.post('/auth/signin',async c=>{
  requireOrigin(c);const data=await json(c,credentials);
  const key=await hash(data.email+':'+(c.req.header('cf-connecting-ip')??'local'));
  const stamp=now(),reset=new Date(Date.now()+15*60_000).toISOString();
  const attempt=await c.env.DB.prepare('INSERT INTO login_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(key,reset,stamp,stamp).first<{attempts:number}>();
  if(!attempt||attempt.attempts>10)throw new HTTPException(429,{message:'Too many sign-in attempts; wait 15 minutes'});
  const row=await c.env.DB.prepare('SELECT id,email,name,password_hash FROM operators WHERE email=?').bind(data.email).first<Operator & {password_hash:string}>();
  // Perform the same KDF for unknown accounts to avoid a cheap account oracle.
  const valid=await passwordMatches(data.password,row?.password_hash ?? 'unknown:invalid');
  if (!row || !valid) throw new HTTPException(401,{message:'Invalid email or password'});
  await c.env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
  return startSession(c,{id:row.id,email:row.email,name:row.name});
});
auth.post('/auth/signout',async c=>{
  requireOrigin(c);const token=getCookie(c,'h2h_session');if(token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();
  deleteCookie(c,'h2h_session',{path:'/'});return c.json({ok:true});
});
