import type {Context} from 'hono'
import type {AppEnv} from '../../platform/env'
import {requireActor} from '../../platform/auth'
import {isProjectActive} from '../../platform/project-status'
import {fail} from './common'
/** Consent selects a project explicitly, including when the native session is in the global inbox. */
export async function nativeAccess(c:Context<AppEnv>,projectId:string){const actor=await requireActor(c);if(actor.role==='contact'||!await isProjectActive(c.env,projectId))fail('SCOPE_DENIED',403);const membership=await c.env.DB.prepare('SELECT role FROM memberships WHERE project_id=? AND user_id=?').bind(projectId,actor.id).first<{role:'owner'|'admin'|'operator'}>();if(!membership)fail('SCOPE_DENIED',403);return {...actor,projectId,role:membership.role}}
