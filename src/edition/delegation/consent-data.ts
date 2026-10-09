import {Hono} from 'hono'
import type {AppEnv} from '../../platform/env'
import {session} from './common'
import {consentRequest,consentToken} from './consent-request'
import {nativeAccess,nativeSettings} from './native-access'
/**
 * JSON behind the Connected applications and consent pages. The pages themselves are dashboard documents
 * rendered by the application shell; these reads re-check the signed-in user, project and role.
 */
export const consentData=new Hono<AppEnv>()
consentData.get('/authorize/request',async c=>{
 const token=session(c),r=await consentRequest(c,c.req.query()),actor=await nativeAccess(c,r.account_id)
 const issued=Date.now(),csrf=await consentToken(token,issued,r)
 const person=await c.env.DB.prepare('SELECT name,email FROM users WHERE id=?').bind(actor.id).first<{name:string|null,email:string}>()
 const project=await c.env.DB.prepare('SELECT name FROM projects WHERE id=?').bind(r.account_id).first<{name:string}>()
 return c.json({data:{request:r,issued,csrf,principal:{id:actor.id,name:person?.name||null,email:person?.email||null},project:{id:r.account_id,name:project?.name||r.account_id}}})
})
consentData.get('/settings/data',async c=>{
 const {project,actor}=await nativeSettings(c)
 const grants=(await c.env.DB.prepare('SELECT id,client_id,scopes,targets,expires_at,revoked_at FROM edition_grants WHERE project_id=? AND principal_id=? ORDER BY created_at DESC LIMIT 100').bind(project,actor.id).all()).results as any[]
 const clients=(await c.env.DB.prepare('SELECT id,origin,redirect_uri FROM edition_clients WHERE project_id=?').bind(project).all()).results as any[]
 return c.json({data:{
  project,role:actor.role,canRegister:actor.role!=='operator',
  grants:grants.map(g=>({id:g.id,clientId:g.client_id,scopes:JSON.parse(g.scopes),targets:JSON.parse(g.targets),expiresAt:g.expires_at,revokedAt:g.revoked_at})),
  clients:clients.map(r=>({id:r.id,origin:r.origin,redirectUri:r.redirect_uri})),
 }})
})
