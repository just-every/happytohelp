import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {scope} from './common'

export function notificationPreference(db:D1Database,projectId:string,userId:string,value:unknown){
 return db.prepare(`INSERT INTO user_project_preferences(project_id,user_id,is_notified_on_unassigned_activity)
 SELECT project_id,user_id,? FROM memberships WHERE project_id=? AND user_id=?
 ON CONFLICT(project_id,user_id) DO UPDATE SET is_notified_on_unassigned_activity=excluded.is_notified_on_unassigned_activity`)
 .bind(value?1:0,projectId,userId)
}

export const memberUpdates=new Hono<AppEnv>()
memberUpdates.put('/projects/:projectId/agents/:userId',async c=>{
 const actor=await scope(c),body=await c.req.json(),userId=c.req.param('userId')
 if(userId!==actor.id&&!['owner','admin'].includes(actor.role))throw new HTTPException(403)
 const member=await c.env.DB.prepare('SELECT role FROM memberships WHERE project_id=? AND user_id=?')
 .bind(actor.projectId,userId).first<{role:string}>()
 if(!member)throw new HTTPException(409,{message:'Membership missing'})
 if(userId!==actor.id&&actor.role!=='owner'&&member.role!=='operator')throw new HTTPException(403)
 if('role' in body&&!['owner','admin','operator'].includes(body.role))throw new HTTPException(403)
 if('role' in body&&body.role!==member.role){
  if(!['owner','admin'].includes(actor.role)||actor.role!=='owner'&&body.role!=='operator')throw new HTTPException(403)
  const result=await c.env.DB.prepare(`UPDATE memberships SET role=? WHERE project_id=? AND user_id=?
   AND (role='operator' OR ?='owner')
   AND (role!='owner' OR (SELECT count(*) FROM memberships WHERE project_id=? AND role='owner')>1)`)
   .bind(body.role,actor.projectId,userId,actor.role,actor.projectId).run()
  if(!result.meta.changes)throw new HTTPException(409,{message:'Membership missing or last owner protected'})
  await c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE project_id=? AND actor_id=? AND role<>?')
   .bind(Date.now(),actor.projectId,userId,body.role).run()
 }
 if('is_notified_on_unassigned_activity' in body){
  await notificationPreference(c.env.DB,actor.projectId,userId,body.is_notified_on_unassigned_activity).run()
 }
 return c.json({updated:true})
})
