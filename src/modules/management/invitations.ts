import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {requiredString} from '../../platform/db'
import {scope} from './common'
import {sendEmail,emailConfigured} from '../integrations/email'
import {INVITATION_LIFETIME_SECONDS,issueInvitation,manageableInvitation,revokeInvitation} from './invitation-store'

export const invitations=new Hono<AppEnv>()
const mailInvitation=(env:AppEnv['Bindings'],projectId:string,email:string,hash:string,url:string)=>sendEmail(env,{to:email,subject:'HappyToHelp project invitation',text:`Accept your invitation: ${url}`,projectId,idempotencyKey:`invite:${hash}`})

invitations.post('/projects/:projectId/agents',async c=>{
 const a=await scope(c,true),b=await c.req.json(),email=requiredString(b.email||b.invitation_email,'email',320).toLowerCase()
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HTTPException(400)
 const role=b.role||'operator'
 if(!['operator','admin','owner'].includes(role)||a.role!=='owner'&&role!=='operator')throw new HTTPException(403)
 const member=await c.env.DB.prepare('SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=?').bind(a.projectId,email).first()
 if(member)throw new HTTPException(409,{message:'Already a project member'})
 const invitation=await issueInvitation(c.env.DB,String(c.env.APP_ORIGIN||new URL(c.req.url).origin),a.projectId,email,role)
 let delivery='not_configured'
 if(emailConfigured(c.env)){const receipt=await mailInvitation(c.env,a.projectId,email,invitation.hash,invitation.url);delivery=receipt.state==='suppressed'?'suppressed':'sent'}
 return c.json({data:{email,role,invitationUrl:invitation.url,expiresIn:INVITATION_LIFETIME_SECONDS,delivery}},201)
})

// Each of these re-reads the caller's membership of the path's workspace and refuses any invitation the
// caller may not manage, so a pending row's id is never enough on its own.
invitations.delete('/projects/:projectId/invitations/:invitationId',async c=>{
 const a=await scope(c,true),invitation=await manageableInvitation(c.env.DB,a.projectId,c.req.param('invitationId'),a.role)
 await revokeInvitation(c.env.DB,a.projectId,invitation.email)
 return c.json({revoked:true})
})

// A link is stored only as a hash, so an existing one cannot be shown again. Copying issues another link
// for the same invitation; links already sent keep working until they expire or the invitation is revoked.
invitations.post('/projects/:projectId/invitations/:invitationId/link',async c=>{
 const a=await scope(c,true),invitation=await manageableInvitation(c.env.DB,a.projectId,c.req.param('invitationId'),a.role)
 const link=await issueInvitation(c.env.DB,String(c.env.APP_ORIGIN||new URL(c.req.url).origin),a.projectId,invitation.email,invitation.role)
 return c.json({data:{email:invitation.email,role:invitation.role,invitationUrl:link.url,expiresIn:INVITATION_LIFETIME_SECONDS}},201)
})

invitations.post('/projects/:projectId/invitations/:invitationId/resend',async c=>{
 const a=await scope(c,true),invitation=await manageableInvitation(c.env.DB,a.projectId,c.req.param('invitationId'),a.role)
 if(!emailConfigured(c.env))throw new HTTPException(503,{message:'Email delivery is not configured, so the invitation cannot be emailed. Copy the link and share it instead.'})
 const link=await issueInvitation(c.env.DB,String(c.env.APP_ORIGIN||new URL(c.req.url).origin),a.projectId,invitation.email,invitation.role)
 const receipt=await mailInvitation(c.env,a.projectId,invitation.email,link.hash,link.url)
 return c.json({data:{email:invitation.email,role:invitation.role,expiresIn:INVITATION_LIFETIME_SECONDS,delivery:receipt.state==='suppressed'?'suppressed':'sent'}},201)
})
