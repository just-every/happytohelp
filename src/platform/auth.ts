import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Actor, AppEnv } from './env'
export async function hashToken(token: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('') }
export async function requireActor(c: Context<AppEnv>): Promise<Actor> {
 const token=c.req.header('Authorization')?.replace(/^Bearer /,'') || (c.req.path.endsWith('/socket') ? c.req.query('token') : undefined) || c.req.header('Cookie')?.match(/(?:^|;\s*)h2h_session=([^;]+)/)?.[1]
 if(!c.req.header('Authorization') && !['GET','HEAD','OPTIONS'].includes(c.req.method) && c.req.header('Origin') && c.req.header('Origin')!==new URL(c.req.url).origin)throw new HTTPException(403,{message:'Cross-origin cookie request denied'})
 if(!token) throw new HTTPException(401,{message:'Authentication required'})
 const row=await c.env.DB.prepare(`SELECT s.actor_id id,COALESCE(s.project_id,'') projectId,s.role,s.contact_id contactId FROM sessions s WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=s.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL) AND (s.project_id IS NULL AND s.role='operator' AND EXISTS(SELECT 1 FROM users u WHERE u.id=s.actor_id) OR s.role='contact' AND EXISTS(SELECT 1 FROM contacts ct WHERE ct.id=s.contact_id AND COALESCE(json_extract(ct.metadata_json,'$.is_blocked'),0)!=1) OR EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=s.project_id AND m.user_id=s.actor_id AND m.role=s.role))`).bind(await hashToken(token),Date.now()).first<Actor>()
 if(!row) throw new HTTPException(401,{message:'Session invalid or expired'})
 c.set('actor',row); return row
}
export async function requireProject(c: Context<AppEnv>,projectId: string,operator=false) {const actor=await requireActor(c);if(actor.projectId!==projectId || (operator && actor.role==='contact'))throw new HTTPException(403,{message:'Project access denied'});return actor}
