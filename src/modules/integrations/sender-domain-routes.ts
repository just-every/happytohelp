import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {scope} from '../management/common'
import {checkSenderDomain,resolveTxt,type TxtResolver} from './sender-domain'
export function senderDomainRoutes(resolver:TxtResolver=resolveTxt){
 const routes=new Hono<AppEnv>()
 routes.get('/projects/:projectId/email-settings/check-domain',async c=>{
  const actor=await scope(c,true)
  const settings=await c.env.DB.prepare('SELECT from_address FROM email_settings WHERE project_id=?').bind(actor.projectId).first<{from_address:string}>()
  const domain=settings?.from_address.split('@')[1]
  if(!domain)throw new HTTPException(409,{message:'Configure a sender address first'})
  const selector=c.req.query('selector')||'resend'
  if(!/^[-a-z0-9_]{1,63}$/i.test(selector))throw new HTTPException(400,{message:'Invalid DKIM selector'})
  return c.json(await checkSenderDomain(domain,resolver,selector))
 })
 return routes
}
