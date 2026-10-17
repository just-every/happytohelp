import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../../platform/env'
import {hashToken} from '../../../platform/auth'
import {id,requiredString} from '../../../platform/db'
import {clientAddress} from '../../../platform/rate-limits'
import {verifyPassword} from '../credentials'
import {sessionCookie} from '../session'
import {accountAudit,runAll} from './factors'
import {sessionFactorStatement} from './state'

/**
 * An owner who lost every second factor recovers with the installation's owner
 * recovery key, which only whoever controls the installation can set (`rer deploy
 * --set-secret H2H_OWNER_RECOVERY_KEY`, or the private local settings), plus the
 * owner's password. Email alone never recovers. Each key value works once; the
 * owner's factors and recovery codes are removed, every session ends, and the
 * recovery is audited in each of the owner's workspaces.
 */
export const ownerRecovery=new Hono<AppEnv>()
ownerRecovery.post('/owner-recovery',async c=>{
 if(c.req.header('Origin')&&c.req.header('Origin')!==new URL(c.req.url).origin)throw new HTTPException(403,{message:'Cross-origin recovery denied'})
 c.header('Cache-Control','no-store')
 const configured=typeof c.env.H2H_OWNER_RECOVERY_KEY==='string'?c.env.H2H_OWNER_RECOVERY_KEY.trim():''
 if(configured.length<32)throw new HTTPException(503,{message:'Owner recovery is not set up on this installation. Set H2H_OWNER_RECOVERY_KEY with rer, then try again.'})
 const body=await c.req.json().catch(()=>({})),email=requiredString(body.email,'email',320).trim().toLowerCase(),now=Date.now()
 const key=await hashToken(`owner-recovery:${email}:${clientAddress(c.req)}`)
 const attempts=await c.env.DB.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END RETURNING failures').bind(key,now,now-3600000,now-3600000).first<{failures:number}>()
 if(!attempts||attempts.failures>5)throw new HTTPException(429,{message:'Too many recovery attempts. Try again in an hour.'})
 const offered=await hashToken(`owner-recovery-key:${typeof body.recoveryKey==='string'?body.recoveryKey.trim():''}`),expected=await hashToken(`owner-recovery-key:${configured}`)
 const owner=await c.env.DB.prepare("SELECT u.id,c.password_hash,(SELECT m.project_id FROM memberships m WHERE m.user_id=u.id AND m.role='owner' ORDER BY m.project_id LIMIT 1) project_id FROM users u JOIN credentials c ON c.user_id=u.id WHERE lower(u.email)=?").bind(email).first<{id:string;password_hash:string;project_id:string|null}>()
 const refuse=async(reason:string)=>{
  if(owner?.project_id)await runAll(c.env.DB,await accountAudit(c.env.DB,owner.id,{category:'auth',action:'owner.recovery_refused',outcome:'refused',actor:{type:'installation'},source:'rer',detail:{reason}}))
  throw new HTTPException(403,{message:'Recovery refused. Check the owner email, password and the installation recovery key.'})
 }
 if(!owner?.project_id)return refuse('not_owner')
 if(offered!==expected)return refuse('key_incorrect')
 if(!await verifyPassword(body.password,owner.password_hash))return refuse('password_incorrect')
 const token=id()+id(),tokenHash=await hashToken(token)
 const results=await c.env.DB.batch([
  c.env.DB.prepare('INSERT INTO owner_recoveries(key_hash,user_id,used_at) VALUES(?,?,?) ON CONFLICT(key_hash) DO NOTHING').bind(expected,owner.id,now),
  c.env.DB.prepare('DELETE FROM user_factors WHERE user_id=? AND EXISTS(SELECT 1 FROM owner_recoveries WHERE key_hash=? AND used_at=?)').bind(owner.id,expected,now),
  c.env.DB.prepare('DELETE FROM recovery_codes WHERE user_id=? AND EXISTS(SELECT 1 FROM owner_recoveries WHERE key_hash=? AND used_at=?)').bind(owner.id,expected,now),
  c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE actor_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM owner_recoveries WHERE key_hash=? AND used_at=?)').bind(now,owner.id,expected,now),
  c.env.DB.prepare("INSERT INTO sessions SELECT ?,?,?,'owner',NULL,?,NULL WHERE EXISTS(SELECT 1 FROM owner_recoveries WHERE key_hash=? AND used_at=?)").bind(tokenHash,owner.id,owner.project_id,now+86400000,expected,now),
 ])
 if(!results[0].meta.changes)return refuse('key_already_used')
 await c.env.DB.batch([sessionFactorStatement(c.env.DB,tokenHash,owner.id,'installation',now),...await accountAudit(c.env.DB,owner.id,{category:'auth',action:'owner.recovered',actor:{type:'installation'},source:'rer',target:{type:'member',id:owner.id},detail:{factorsRemoved:true}})])
 await c.env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run()
 c.header('Set-Cookie',sessionCookie(token,c.req.url))
 return c.json({recovered:true,destination:'/users/profile'})
})
