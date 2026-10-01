import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken, requireActor } from '../../platform/auth'

/** What an emailed or shared link will do, learned before anything is consumed. */
export type LinkState = 'missing' | 'invalid' | 'expired' | 'used' | 'valid'
interface TokenRow { email: string; expires_at: number; consumed_at: number | null }
interface InviteRow extends TokenRow { role: string; workspace: string; project_id: string; account_exists: number }
interface RegistrationRow extends TokenRow { workspace: string }

const notDeleted = (project: string) => `NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=${project} AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)`
const stateOf = (row: TokenRow | null): LinkState => !row ? 'invalid' : row.consumed_at !== null ? 'used' : row.expires_at <= Date.now() ? 'expired' : 'valid'

// The signed-in account, if any, so an invitation page can tell the invitee apart from someone else's session.
async function viewer(c: Context<AppEnv>, invitedEmail: string) {
 try {
  const actor = await requireActor(c)
  if (actor.role === 'contact') return {signedIn: false, email: null, matches: false}
  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id=?').bind(actor.id).first<{email: string}>()
  if (!user) return {signedIn: false, email: null, matches: false}
  return {signedIn: true, email: user.email, matches: user.email.toLowerCase() === invitedEmail}
 } catch (error) {
  if (error instanceof HTTPException) return {signedIn: false, email: null, matches: false}
  throw error
 }
}

export const linkStatus = new Hono<AppEnv>()
// POST keeps the secret token out of request URLs and logs. Nothing here consumes a token or counts against a limit.
linkStatus.post('/link-status', async c => {
 c.header('Cache-Control', 'no-store')
 const body = await c.req.json().catch(() => null) as {kind?: unknown; token?: unknown} | null
 const kind = body?.kind, token = body?.token
 if (kind !== 'invitation' && kind !== 'reset' && kind !== 'verify-email') throw new HTTPException(400, {message: 'Unknown link kind'})
 if (typeof token !== 'string' || !token.trim()) return c.json({state: 'missing' satisfies LinkState})
 if (token.length > 512) return c.json({state: 'invalid' satisfies LinkState})
 const hash = await hashToken(token)
 if (kind === 'verify-email') {
  const row = await c.env.DB.prepare('SELECT email,project_name workspace,expires_at,consumed_at FROM registrations WHERE token_hash=?').bind(hash).first<RegistrationRow>()
  const state = stateOf(row)
  return c.json(state === 'valid' ? {state, email: row!.email, workspace: row!.workspace} : {state})
 }
 if (kind === 'reset') {
  const row = await c.env.DB.prepare("SELECT email,expires_at,consumed_at FROM identity_tokens WHERE token_hash=? AND kind='reset'").bind(hash).first<TokenRow>()
  const state = stateOf(row)
  return c.json(state === 'valid' ? {state, email: row!.email} : {state})
 }
 const row = await c.env.DB.prepare(`SELECT t.email,t.role,t.project_id,t.expires_at,t.consumed_at,p.name workspace,EXISTS(SELECT 1 FROM users u WHERE lower(u.email)=lower(t.email)) account_exists FROM identity_tokens t JOIN projects p ON p.id=t.project_id WHERE t.token_hash=? AND t.kind='invite' AND ${notDeleted('p.id')}`).bind(hash).first<InviteRow>()
 const state = stateOf(row)
 if (state !== 'valid') return c.json({state})
 return c.json({state, email: row!.email, role: row!.role, workspace: row!.workspace, projectId: row!.project_id, accountExists: row!.account_exists === 1, expiresAt: row!.expires_at, viewer: await viewer(c, row!.email.toLowerCase())})
})
