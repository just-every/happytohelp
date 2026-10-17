import {HTTPException} from 'hono/http-exception'
import type {Actor,Env} from '../../platform/env'
import type {TokenAuthority} from '../../platform/integration-authority'
import {mutateTicket} from '../tickets/mutate'
import {resolutionState} from './state'
export interface ConversationTransition {resolved?:boolean;agent_id?:string|null;ai_id?:string|null}
/** Legacy assignment/resolution doors share the ticket authority and atomic frontier. */
export async function transitionConversation(env:Env,actor:Actor,conversationId:string,change:ConversationTransition,sessionHash?:string,tokenAuthority?:TokenAuthority){
 if(actor.role==='contact')throw new HTTPException(403)
 if(!sessionHash&&!tokenAuthority)throw new HTTPException(401)
 if(change.resolved!==undefined&&typeof change.resolved!=='boolean')throw new HTTPException(400)
 const {resolved,...assignment}=change
 await mutateTicket(env,actor,conversationId,{...assignment,...(resolved===undefined?{}:{status_id:resolved?'solved':'open'})},{sessionHash,tokenAuthority})
 return resolutionState(env,actor.projectId,conversationId)
}
export function setConversationResolved(env:Env,actor:Actor,conversationId:string,resolved:boolean,sessionHash?:string){return transitionConversation(env,actor,conversationId,{resolved},sessionHash)}
