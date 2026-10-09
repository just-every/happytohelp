import type {Context} from 'hono'
import type {AppEnv} from '../../platform/env'
import {requireActor} from '../../platform/auth'
import {isProjectActive} from '../../platform/project-status'
import {fail,session,text} from './common'
/** Consent selects a project explicitly, including when the native session is in the global inbox. */
export async function nativeAccess(c:Context<AppEnv>,projectId:string){const actor=await requireActor(c);if(actor.role==='contact'||!await isProjectActive(c.env,projectId))fail('SCOPE_DENIED',403);const membership=await c.env.DB.prepare('SELECT role FROM memberships WHERE project_id=? AND user_id=?').bind(projectId,actor.id).first<{role:'owner'|'admin'|'operator'}>();if(!membership||!['owner','admin','operator'].includes(membership.role))fail('SCOPE_DENIED',403);return {...actor,projectId,role:membership.role}}
/** Project settings and their form posts name the project in `account_id`; the signed-in member's access to it is re-checked. */
export async function nativeSettings(c:Context<AppEnv>){session(c);const project=text(c.req.query('account_id')|| (await c.req.parseBody()).account_id,200);const actor=await nativeAccess(c,project);return {project,actor}}
