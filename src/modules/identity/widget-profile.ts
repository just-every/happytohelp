import {Hono,type MiddlewareHandler} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {requireActor} from '../../platform/auth'

export const widgetProfile=new Hono<AppEnv>()
// Run before project CORS: a rejected credential must not turn an Origin header
// into a database lookup. Preflight retains the existing widget CORS policy.
export const visitorProfileCredential:MiddlewareHandler<AppEnv>=async(c,next)=>{
 if(c.req.method==='OPTIONS')return next()
 c.header('Cache-Control','no-store')
 // A visitor capability is explicit. An owner cookie cannot supply or replace it.
 const authorization=c.req.header('Authorization')||''
 if(!/^Bearer \S+$/.test(authorization))throw new HTTPException(401,{message:'Authentication required'})
 if(/^Bearer int_[a-f0-9]{64}$/.test(authorization))throw new HTTPException(404,{message:'Not found'})
 await next()
}
widgetProfile.get('/widget/profile',async c=>{
 const actor=await requireActor(c)
 if(actor.role!=='contact'||!actor.contactId)throw new HTTPException(404,{message:'Not found'})
 // Admission is not a cached read grant. Resolve only this session's contact and
 // recheck live authority and privacy in the very SQL statement reading PII.
 const profile=await c.env.DB.prepare(`SELECT profile_contact.id,profile_contact.name,profile_contact.email,profile_contact.is_verified
  FROM sessions profile_session
  JOIN contacts profile_contact ON profile_contact.id=profile_session.contact_id
   AND profile_contact.id=profile_session.actor_id AND profile_contact.project_id=profile_session.project_id
  JOIN projects profile_project ON profile_project.id=profile_session.project_id
  WHERE profile_session.token_hash=? AND profile_session.role='contact'
   AND profile_session.actor_id=? AND profile_session.contact_id=? AND profile_session.project_id=?
   AND profile_session.revoked_at IS NULL
   AND profile_session.expires_at>max(?,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
   AND coalesce(json_extract(profile_contact.metadata_json,'$.is_blocked'),0)!=1
   AND coalesce(json_extract(profile_contact.metadata_json,'$.is_deleted'),0)!=1
   AND coalesce(json_extract(profile_contact.metadata_json,'$.is_erasing'),0)!=1
   AND coalesce(json_extract(profile_contact.metadata_json,'$.is_erased'),0)!=1
   AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=profile_project.id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)`)
  .bind(c.get('sessionHash'),actor.id,actor.contactId,actor.projectId,Date.now())
  .first<{id:string;name:string|null;email:string|null;is_verified:number}>()
 if(!profile)throw new HTTPException(404,{message:'Not found'})
 return c.json({contact:{id:profile.id,name:profile.name,email:profile.email,verified:profile.is_verified===1}})
})
