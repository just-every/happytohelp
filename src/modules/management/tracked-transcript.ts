import type {Env} from '../../platform/env'
import {iso,person} from './dashboard-data'

/** Only explicitly attributed events belong to a conversation transcript. */
export async function trackedTranscript(env:Env,conversation:any,bucketId:string){
 const rows=(await env.DB.prepare(`SELECT e.* FROM context_tracked_events e
  JOIN conversations c ON c.id=? AND c.project_id=e.project_id AND c.contact_id=e.subject_id
  WHERE e.project_id=? AND e.subject_id=? AND json_valid(e.payload)
  AND json_extract(e.payload,'$.conversation_id')=c.id
  AND coalesce(json_extract(e.payload,'$.bucket_id'),c.id)=?
  ORDER BY e.created_at,e.id`).bind(conversation.id,conversation.project_id,conversation.contact_id,bucketId).all()).results
 const contact=person(await env.DB.prepare('SELECT id,name,email FROM contacts WHERE id=? AND project_id=?').bind(conversation.contact_id,conversation.project_id).first())
 const events=[]
 for(const row of rows){
  const data=JSON.parse(String(row.payload))
  let payload:any
  if(row.type==='PAGE_VIEW'){
   if(typeof data.url!=='string'||!data.url.trim())continue
   // Browser links must be a web URL or an absolute site path.
   if(!/^https?:\/\//i.test(data.url)&&!/^\/(?!\/)/.test(data.url))continue
   payload=data.url
  }else if(row.type==='AGENT_ASSIGNED'){
   payload={is_ai:data.is_ai===true,type:typeof data.type==='string'?data.type:undefined,name:typeof data.name==='string'?data.name:undefined,role:typeof data.role==='string'?data.role:undefined}
  }else if(row.type==='USED_INSIGHT'){
   if(typeof data.insight_id!=='string'||!await env.DB.prepare('SELECT id FROM context_insights WHERE id=? AND project_id=? AND subject_id=?').bind(data.insight_id,conversation.project_id,conversation.contact_id).first())continue
   payload={insight_id:data.insight_id}
  }else continue
  const agent=typeof data.agent_id==='string'?person(await env.DB.prepare('SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=? AND m.project_id=?').bind(data.agent_id,conversation.project_id).first()):null
  if(data.agent_id&&!agent)continue
  events.push({id:row.id,type:row.type,payload,conversation_id:conversation.id,bucket_id:bucketId,created_at:iso(row.created_at),agent,agent_id:agent?.id||null,contact:agent?null:contact,contact_id:agent?null:conversation.contact_id,...(row.type==='USED_INSIGHT'?{close:data.close===true}:{})})
 }
 return events
}
