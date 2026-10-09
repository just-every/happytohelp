import {HTTPException} from 'hono/http-exception'
import {hashToken} from '../../platform/auth'
import {id} from '../../platform/db'

const LIFETIME_MS = 86400000
export const INVITATION_LIFETIME_SECONDS = LIFETIME_MS / 1000

interface LiveToken {email: string; role: string; expires_at: number}
export interface PendingInvitation {invitation_id: string; email: string; role: string; expires_at: number; pending: 1; canManage: boolean}

// An invitation is the set of unused, unexpired invite links for one email in one workspace.
// Copying a link or resending the email adds a link; revoking removes every one of them.
const liveTokens = (db: D1Database, projectId: string, email?: string) => db.prepare(`SELECT lower(email) email,role,expires_at FROM identity_tokens WHERE project_id=? AND kind='invite' AND consumed_at IS NULL AND expires_at>?${email ? ' AND lower(email)=?' : ''} ORDER BY expires_at DESC`).bind(projectId, Date.now(), ...(email ? [email] : [])).all<LiveToken>().then(result => result.results)

/** Owners manage every invitation; admins only invitations that grant the operator role, as when inviting. */
const mayManage = (actorRole: string, tokens: LiveToken[]) => actorRole === 'owner' || actorRole === 'admin' && tokens.every(token => token.role === 'operator')

function summarize(tokens: LiveToken[], actorRole: string): Omit<PendingInvitation, 'pending'> {
 const newest = tokens[0]
 return {invitation_id: newest.email, email: newest.email, role: newest.role, expires_at: newest.expires_at, canManage: mayManage(actorRole, tokens)}
}

export async function pendingInvitations(db: D1Database, projectId: string, actorRole: string): Promise<PendingInvitation[]> {
 const byEmail = new Map<string, LiveToken[]>()
 for (const token of await liveTokens(db, projectId)) byEmail.set(token.email, [...byEmail.get(token.email) ?? [], token])
 return [...byEmail.values()].map(tokens => ({...summarize(tokens, actorRole), pending: 1 as const}))
}

/** The invitation named by the path, in the caller's own workspace, if the caller may manage it. */
export async function manageableInvitation(db: D1Database, projectId: string, invitationId: string, actorRole: string) {
 const tokens = await liveTokens(db, projectId, invitationId.trim().toLowerCase())
 if (!tokens.length) throw new HTTPException(404, {message: 'Invitation not found. It may have been used, revoked or expired.'})
 if (!mayManage(actorRole, tokens)) throw new HTTPException(403, {message: 'Only a workspace owner can manage an invitation that grants more than the agent role'})
 return summarize(tokens, actorRole)
}

export async function issueInvitation(db: D1Database, requestUrl: string, projectId: string, email: string, role: string) {
 const token = id() + id(), hash = await hashToken(token)
 await db.prepare("INSERT INTO identity_tokens VALUES(?,NULL,?,?,?,'invite',?,NULL)").bind(hash, projectId, email, role, Date.now() + LIFETIME_MS).run()
 const url = new URL('/accept-invitation', requestUrl)
 url.searchParams.set('token', token)
 return {hash, url: url.href}
}

export async function revokeInvitation(db: D1Database, projectId: string, email: string) {
 const result = await db.prepare("DELETE FROM identity_tokens WHERE project_id=? AND kind='invite' AND consumed_at IS NULL AND lower(email)=?").bind(projectId, email).run()
 return result.meta.changes
}
