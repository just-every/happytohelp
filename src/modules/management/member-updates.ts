import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {scope} from './common'
import {assignRole} from '../access/assign'

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
 if('role' in body)await assignRole(c,actor,userId,body.role)
 if('is_notified_on_unassigned_activity' in body){
  await notificationPreference(c.env.DB,actor.projectId,userId,body.is_notified_on_unassigned_activity).run()
 }
 return c.json({updated:true})
})
