import {HTTPException} from 'hono/http-exception'
import type {Actor,Env} from '../../platform/env'
import {publishActivity} from './activity'

/** Read only the displayed message ids when supplied. No client timestamps. */
export async function recordMessageReads(env:Env,actor:Actor,conversation:{id:string;revision:number},ids?:unknown){
 if(ids!==undefined&&(!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=='string')))throw new HTTPException(400,{message:'Invalid read message ids'})
 const selected=ids===undefined?null:[...new Set(ids as string[])]
 if(selected?.length===0)return
 const contact=actor.role==='contact',now=Date.now()
 const predicate=`m.conversation_id=? AND m.project_id=? AND m.revision<=? AND ${contact?"m.actor_role<>'contact'":"m.actor_role='contact'"}${selected?` AND m.id IN (${selected.map(()=>'?').join(',')})`:''}`
 const args=[conversation.id,actor.projectId,conversation.revision,...(selected||[])]
 await env.DB.batch([
  env.DB.prepare(`INSERT OR IGNORE INTO context_tracked_events(id,project_id,subject_id,local_id,type,payload,created_at) SELECT lower(hex(randomblob(16))),m.project_id,c.contact_id,'read:'||m.id||':'||?,'MESSAGE_READ',json_object('message_id',m.id,'reader_id',?,'reader_role',?,'conversation_id',c.id),? FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE ${predicate}`).bind(actor.id,actor.id,contact?'contact':'operator',now,...args),
  env.DB.prepare(`INSERT INTO conversation_reads(conversation_id,user_id,revision) SELECT ?,?,coalesce(max(m.revision),0) FROM messages m WHERE m.conversation_id=? AND m.project_id=? AND m.revision<=?${selected?` AND m.id IN (${selected.map(()=>'?').join(',')})`:''} ON CONFLICT(conversation_id,user_id) DO UPDATE SET revision=max(revision,excluded.revision)`).bind(conversation.id,actor.id,...args),
 ])
 await publishActivity(env,actor.projectId,conversation.id,'read')
}

export async function messageReadData(env:Env,message:{id:string;project_id:string}){
 const receipts=(await env.DB.prepare("SELECT json_extract(payload,'$.reader_id') reader_id,json_extract(payload,'$.reader_role') reader_role,created_at read_at FROM context_tracked_events WHERE project_id=? AND type='MESSAGE_READ' AND json_valid(payload) AND json_extract(payload,'$.message_id')=?").bind(message.project_id,message.id).all()).results
 const byRole=(role:string)=>Object.fromEntries(receipts.filter(r=>r.reader_role===role).map(r=>[String(r.reader_id),new Date(Number(r.read_at)).toISOString()]))
 return {read_by_contacts:byRole('contact'),read_by_agents:byRole('operator')}
}
