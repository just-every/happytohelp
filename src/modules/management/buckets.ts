import type {Env} from '../../platform/env'
import {messageData,iso,person} from './dashboard-data'
import {trackedTranscript} from './tracked-transcript'
import {attachInboundOrigins} from '../integrations/inbound-origin'
import {ceilingTranscript} from './ceiling-transcript'

export async function bucketData(env:Env,conversation:any,bucketId:string){
 const bucket=await env.DB.prepare('SELECT * FROM conversation_buckets WHERE id=? AND conversation_id=?').bind(bucketId,conversation.id).first<any>()
 if(!bucket&&bucketId!==conversation.id)return null
 const rows=(await env.DB.prepare('SELECT * FROM messages WHERE project_id=? AND conversation_id=? AND coalesce(bucket_id,conversation_id)=? ORDER BY revision').bind(conversation.project_id,conversation.id,bucketId).all()).results
 const notes=bucketId===conversation.id?(await env.DB.prepare('SELECT n.*,u.name FROM conversation_notes n JOIN users u ON u.id=n.user_id WHERE n.conversation_id=? ORDER BY n.created_at').bind(conversation.id).all()).results:[]
 const events=[...notes.map((n:any)=>({id:n.id,type:'INTERNAL_NOTE',payload:n.content,content:n.content,conversation_id:conversation.id,bucket_id:bucketId,agent:person({id:n.user_id,name:n.name}),agent_id:n.user_id,created_at:iso(n.created_at)})),...await trackedTranscript(env,conversation,bucketId),...await ceilingTranscript(env,conversation,bucketId)].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)))
 const messages=await attachInboundOrigins(env,String(conversation.project_id),await Promise.all(rows.map(r=>messageData(env,r))))
 const counts:Record<string,number>={contact_messages:rows.filter(r=>r.actor_role==='contact').length,agent_messages:rows.filter(r=>r.actor_role!=='contact').length,agent_events_internal_note:notes.length}
 for(const event of events){if(event.type==='INTERNAL_NOTE'||event.type==='AI_REPLY_SKIPPED')continue;const key=`${event.agent_id?'agent':'contact'}_events_${String(event.type).toLowerCase()}`;counts[key]=(counts[key]||0)+1}
 const starts=[...rows.map(row=>Number(row.created_at)),...events.map(event=>Date.parse(event.created_at||''))].filter(Number.isFinite)
 const createdAt=bucket?.created_at||(starts.length?Math.min(...starts):conversation.created_at)
 const updatedAt=Math.max(Number(rows.at(-1)?.created_at||0),...events.map(event=>Date.parse(event.created_at||'')||0),Number(bucket?.created_at||conversation.created_at))
 return {id:bucketId,conversation_id:conversation.id,type:'messages',created_at:iso(createdAt),updated_at:iso(updatedAt),first_message:messages[0]||null,last_message:messages.at(-1)||null,counts,messages,events}
}
