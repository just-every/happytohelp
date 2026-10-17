import type {Context} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv,ActorSecurity} from '../../../platform/env'
import {auditStatement,requestSource} from '../../audit/record'
import {recentStepUp} from './state'
import {jsonResponse} from '../../../platform/json-response'

/**
 * Exports, erasure, role changes, credential installs, refund approval and the
 * two-factor policy need a recent step-up: the second factor within 15 minutes, or
 * the password for an account without one. `factor` demands a second factor even
 * then (resetting a teammate's factor). The local rer dev entry is installation custody.
 */
export async function requireStepUp(c:Context<AppEnv>,actor:{id:string;projectId:string;security?:ActorSecurity},purpose:string,{factor=false}:{factor?:boolean}={}){
 const security=actor.security
 if(!security)throw new HTTPException(403)
 if(factor&&!security.hasFactor&&!security.installation)
  throw new HTTPException(403,{res:jsonResponse({error:'Set up two-factor sign-in for your own account first.',code:'two_factor_setup_required'},403)})
 if(recentStepUp(security))return
 if(actor.projectId)await auditStatement(c.env.DB,{projectId:actor.projectId,category:'auth',action:'step_up.required',outcome:'refused',actor:{type:'user',id:actor.id},source:requestSource(c),purpose}).run()
 throw new HTTPException(403,{res:jsonResponse({error:security.hasFactor?'Confirm it is you with your authenticator code or passkey, then try again.':'Confirm your password, then try again.',code:'step_up_required',methods:security.hasFactor?['totp','webauthn','recovery']:['password'],purpose},403)})
}
