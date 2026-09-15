import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { id, requiredString } from '../../platform/db'
import { passwordHash } from './credentials'
import { sessionCookie } from './session'

export const setup = new Hono<AppEnv>()
const available = 'NOT EXISTS(SELECT 1 FROM owner_setup) AND NOT EXISTS(SELECT 1 FROM users) AND NOT EXISTS(SELECT 1 FROM projects)'
setup.get('/setup', async c => {
 const state = await c.env.DB.prepare(`SELECT (${available}) AS available`).first<{available: number}>()
 c.header('Cache-Control', 'no-store')
 return c.json({available: state?.available === 1})
})
setup.post('/bootstrap', async c => {
 const origin = c.req.header('Origin')
 if ((origin && origin !== new URL(c.req.url).origin) || c.req.header('Sec-Fetch-Site') === 'cross-site') {
  throw new HTTPException(403, {message: 'Owner setup must be submitted from this site'})
 }
 let body: Record<string, unknown>
 try {
  body = await c.req.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
 } catch { throw new HTTPException(400, {message: 'Submit a JSON object with name, email, password and allowedOrigin'}) }
 const name = requiredString(body.name, 'name', 200).trim()
 const email = requiredString(body.email, 'email', 320).trim().toLowerCase()
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HTTPException(400, {message: 'Enter a valid email address'})
 let allowedOrigin: string
 try {
  const url = new URL(requiredString(body.allowedOrigin, 'allowedOrigin'))
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
  allowedOrigin = url.origin
 } catch { throw new HTTPException(400, {message: 'Website URL must be a valid http:// or https:// URL'}) }
 const password = await passwordHash(body.password as string)
 const projectId = id(), userId = id(), token = id() + id(), now = Date.now()
 const guard = 'EXISTS(SELECT 1 FROM owner_setup WHERE singleton=1 AND claim_id=?)'
 const results = await c.env.DB.batch([
  c.env.DB.prepare(`INSERT INTO owner_setup SELECT 1,? WHERE ${available} ON CONFLICT(singleton) DO NOTHING`).bind(userId),
  c.env.DB.prepare(`INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) SELECT ?,?,?,?,? WHERE ${guard}`).bind(projectId,name,id(),allowedOrigin,now,userId),
  c.env.DB.prepare(`INSERT INTO users(id,email,name,created_at) SELECT ?,?,?,? WHERE ${guard}`).bind(userId,email,name,now,userId),
  c.env.DB.prepare(`INSERT INTO credentials(user_id,password_hash,updated_at) SELECT ?,?,? WHERE ${guard}`).bind(userId,password,now,userId),
  c.env.DB.prepare(`INSERT INTO memberships SELECT ?,?,'owner' WHERE ${guard}`).bind(projectId,userId,userId),
  c.env.DB.prepare(`INSERT INTO sessions SELECT ?,?,?,'owner',NULL,?,NULL WHERE ${guard}`).bind(await hashToken(token),userId,projectId,now+86400000,userId),
 ])
 if (!results[0].meta.changes) throw new HTTPException(409, {message: 'Owner setup is already complete. Sign in with your existing account.'})
 c.header('Set-Cookie', sessionCookie(token,c.req.url))
 c.header('Cache-Control', 'no-store')
 return c.json({projectId,userId,token},201)
})
