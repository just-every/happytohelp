import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { id, requiredString } from '../../platform/db'
import { passwordHash } from './credentials'
import { sessionCookie } from './session'
import { localDevelopmentRequest } from '../../platform/local-host'

export const setup = new Hono<AppEnv>()
const available = 'NOT EXISTS(SELECT 1 FROM owner_setup) AND NOT EXISTS(SELECT 1 FROM users) AND NOT EXISTS(SELECT 1 FROM projects)'
const configuredToken = (env: AppEnv['Bindings']) => typeof env.H2H_SETUP_TOKEN === 'string' && env.H2H_SETUP_TOKEN.trim() ? env.H2H_SETUP_TOKEN : ''
// Only loopback development may claim the first owner without a private setup token.
const tokenRequired = (env: AppEnv['Bindings'], url: string) => Boolean(env.RER_INSTALLATION_ID || configuredToken(env) || !localDevelopmentRequest(url, env.APP_ORIGIN))
/** True while nobody has claimed the installation: no owner record, user or project exists. */
export async function setupAvailable(db: D1Database) {
 const state = await db.prepare(`SELECT (${available}) AS available`).first<{available: number}>()
 return state?.available === 1
}
// Independent deployment readiness exposes no owner identity or credentials.
setup.get('/setup-status', async c => {
 const required = await setupAvailable(c.env.DB)
 c.header('Cache-Control', 'no-store')
 return c.json({setupRequired: required}, required ? 409 : 200)
})
setup.get('/setup', async c => {
 const open = await setupAvailable(c.env.DB)
 c.header('Cache-Control', 'no-store')
 return c.json({available: open, ...(tokenRequired(c.env, c.req.url) ? {tokenRequired: true} : {})})
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
 const expectedToken = configuredToken(c.env)
 if (!expectedToken && tokenRequired(c.env, c.req.url)) {
  throw new HTTPException(503, {message: c.env.RER_INSTALLATION_ID ? 'Owner setup is awaiting its installation credential' : 'Owner setup on this deployment requires a private H2H_SETUP_TOKEN. Configure it, deploy again, then enter it here.'})
 }
 if (expectedToken) {
  if (typeof body.setupToken !== 'string' || body.setupToken.length > 1024) throw new HTTPException(403, {message: 'A valid owner setup token is required'})
  const expected = await hashToken(expectedToken), supplied = await hashToken(body.setupToken)
  let difference = 0
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index)
  if (difference) throw new HTTPException(403, {message: 'A valid owner setup token is required'})
 }
 const name = requiredString(body.name, 'name', 200).trim()
 const ownerName = body.ownerName === undefined ? name : requiredString(body.ownerName, 'ownerName', 200).trim()
 const primaryColor = body.primaryColor
 if (primaryColor !== undefined && (typeof primaryColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(primaryColor))) {
  throw new HTTPException(400, {message: 'Choose a six-digit brand colour'})
 }
 const email = requiredString(body.email, 'email', 320).trim().toLowerCase()
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HTTPException(400, {message: 'Enter a valid email address'})
 if (c.env.H2H_SETUP_OWNER_EMAIL && email !== c.env.H2H_SETUP_OWNER_EMAIL.trim().toLowerCase()) {
  throw new HTTPException(403, {message: 'Use the owner email selected for this installation'})
 }
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
  ...(primaryColor === undefined ? [] : [c.env.DB.prepare(`INSERT INTO project_settings(project_id,settings_json,updated_at) SELECT ?,?,? WHERE ${guard}`).bind(projectId,JSON.stringify({primary_color: primaryColor.toLowerCase()}),now,userId)]),
  c.env.DB.prepare(`INSERT INTO users(id,email,name,created_at) SELECT ?,?,?,? WHERE ${guard}`).bind(userId,email,ownerName,now,userId),
  c.env.DB.prepare(`INSERT INTO credentials(user_id,password_hash,updated_at) SELECT ?,?,? WHERE ${guard}`).bind(userId,password,now,userId),
  c.env.DB.prepare(`INSERT INTO memberships SELECT ?,?,'owner' WHERE ${guard}`).bind(projectId,userId,userId),
  c.env.DB.prepare(`INSERT INTO sessions SELECT ?,?,?,'owner',NULL,?,NULL WHERE ${guard}`).bind(await hashToken(token),userId,projectId,now+86400000,userId),
 ])
 if (!results[0].meta.changes) throw new HTTPException(409, {message: 'Owner setup is already complete. Sign in with your existing account.'})
 c.header('Set-Cookie', sessionCookie(token,c.req.url))
 c.header('Cache-Control', 'no-store')
 return c.json({projectId,userId,token},201)
})
