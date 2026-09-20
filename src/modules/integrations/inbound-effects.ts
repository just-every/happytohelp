import type {Env} from '../../platform/env'
import {onCustomerMessage} from '../ai-support/service'

type WaitUntilContext={waitUntil(promise:Promise<unknown>):void}
export function scheduleInboundEffects(env:Env,execution:WaitUntilContext,result:any){
 if(result.duplicate||!result.message||!result.actor)return
 execution.waitUntil(env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(result.conversationId)).fetch('https://conversation.internal/broadcast',{method:'POST',body:JSON.stringify({conversationId:result.conversationId})}))
 execution.waitUntil(onCustomerMessage(env,result.message,result.actor))
}
