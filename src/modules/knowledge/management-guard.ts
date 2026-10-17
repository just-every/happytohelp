import type {Context} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {memberAccess} from '../access/gate'
import type {SqlGuard} from '../../platform/integration-authority'
export async function knowledgeEditorGuard(c:Context<AppEnv>):Promise<SqlGuard>{
 const actor=c.get('actor'),projectId=c.req.param('projectId')!,access=await memberAccess(c.env.DB,projectId,actor.id)
 if(!access?.permissions.has('knowledge.publish'))throw new HTTPException(403,{message:'Knowledge publication permission required'})
 return {sql:`SELECT 1 FROM sessions s JOIN memberships m ON m.user_id=s.actor_id AND m.project_id=? LEFT JOIN member_roles mr ON mr.project_id=m.project_id AND mr.user_id=m.user_id LEFT JOIN project_roles pr ON pr.id=mr.role_key AND pr.project_id=m.project_id WHERE (m.role='owner' OR (mr.role_key IS NULL AND m.role IN ('admin','operator')) OR (pr.base IN ('admin','operator') AND EXISTS(SELECT 1 FROM json_each(pr.permissions_json) WHERE value='knowledge.publish'))) AND s.token_hash=? AND s.actor_id=? AND s.role<>'contact' AND s.revoked_at IS NULL AND s.expires_at>? AND EXISTS(SELECT 1 FROM projects p WHERE p.id=m.project_id AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=p.id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL))`,params:[projectId,c.get('sessionHash'),actor.id,Date.now()]}
}
