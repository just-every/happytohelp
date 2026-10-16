import type {Env} from '../../platform/env'

/** Activity frames invalidate authenticated projections, never carry private text.
 * The database is authoritative; reconnect always fetches its current snapshot. */
export async function publishActivity(env:Env,projectId:string,conversationId:string,kind:string){
 const body=JSON.stringify({type:'activity',operatorOnly:true,projectId,conversationId,kind})
 await Promise.all([conversationId,`project:${projectId}`].map(name=>
  env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(name)).fetch('https://conversation.internal/event',{method:'POST',body})))
}
