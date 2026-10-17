import type {Context} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../../platform/env'
import {requestSource} from '../../audit/record'
import {jsonResponse} from '../../../platform/json-response'
import {verifyPassword} from '../credentials'
import {accountAudit,claimAttempt,clearAttempts,runAll} from './factors'

/**
 * Checks the password a signed-in person enters again (a step-up, or changing it). Each answer
 * claims an attempt before it is checked, so at most five are evaluated per account in fifteen
 * minutes, however many arrive at once. A wrong or limited answer is refused and audited as
 * `refusedAction`; the right one clears the count.
 */
export async function provePassword(c:Context<AppEnv>,userId:string,password:unknown,passwordHash:string|null,{refusedAction,message}:{refusedAction:string;message:string}){
 const db=c.env.DB
 const refuse=async(reason:'rate_limited'|'password_incorrect',status:403|429):Promise<never>=>{
  await runAll(db,await accountAudit(db,userId,{category:'auth',action:refusedAction,outcome:'refused',actor:{type:'user',id:userId},source:requestSource(c),detail:{reason}}))
  throw new HTTPException(status,{res:jsonResponse({error:status===429?'Too many incorrect passwords. Wait 15 minutes, then try again.':message,code:reason},status)})
 }
 if(!await claimAttempt(db,'password',userId))return refuse('rate_limited',429)
 if(!passwordHash||typeof password!=='string'||!await verifyPassword(password,passwordHash))return refuse('password_incorrect',403)
 await clearAttempts(db,'password',userId)
}
