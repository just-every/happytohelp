import {resolvePublicCitations,citationAdmissionGuard,activeSourceProjectSql,type PublicReference} from '../knowledge/public-sources.ts'
import type { Actor,Env } from '../../platform/env'
/** Local ids the server mints: `email:` identifies an inbound email claim and `erased:`
 * replaces a client-supplied id when its contact is erased (contact-erasure/statements.ts).
 * Clients may use neither. */
export const reservedLocalId=(localId:unknown)=>typeof localId==='string'&&/^(?:email|erased):/.test(localId)
export interface MessageInput {projectId:string;conversationId:string;actor:Actor;localId:string;content:string;expectedRevision:number;expectedLastMessageId?:string|null;mediaIds?:string[];resolve?:boolean;generationId?:string;citations?:PublicReference[]}
export async function admitMessage(env:Env,input:MessageInput){
 const {projectId,conversationId,actor,localId,content,expectedRevision}=input
 if(actor.projectId!==projectId)throw new Error('Project access denied')
 if(!localId||localId.length>200||localId.startsWith('erased:')||typeof content!=='string'||content.length>100000||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('Invalid message command')
 if(input.citations?.length&&!input.generationId)throw new Error('Only finalized AI messages may cite knowledge')
 const refs=input.citations??[]
 if(!Array.isArray(refs)||refs.length>10||refs.some(r=>!r||typeof r.id!=='string'||typeof r.sourceVersion!=='string'))throw new Error('Invalid public citations')
 const mediaIds=[...new Set(input.mediaIds||[])];if(mediaIds.length>20||(!content.trim()&&!mediaIds.length))throw new Error('Invalid message content')
 const intentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({content,mediaIds:[...mediaIds].sort(),resolve:!!input.resolve,expectedRevision,expectedLastMessageId:input.expectedLastMessageId,generationId:input.generationId,...(refs.length?{citations:refs.map(r=>({id:r.id,sourceVersion:r.sourceVersion}))}: {})}))))).map(x=>x.toString(16).padStart(2,'0')).join('')
 const scope=await env.DB.prepare('SELECT contact_id FROM conversations WHERE id=? AND project_id=?').bind(conversationId,projectId).first<{contact_id:string}>()
 if(!scope||(!input.generationId&&actor.role==='contact'&&scope.contact_id!==(actor.contactId||actor.id)))return {accepted:false,reason:'conversation_access_denied'}
 if(!input.generationId&&actor.role!=='contact'&&!await env.DB.prepare('SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role=?').bind(projectId,actor.id,actor.role).first())return {accepted:false,reason:'conversation_access_denied'}
 const generation=input.generationId?await env.DB.prepare('SELECT ai_id FROM ai_generations WHERE id=? AND project_id=? AND conversation_id=?').bind(input.generationId,projectId,conversationId).first<{ai_id:string}>():null
 if(input.generationId&&!generation)return {accepted:false,reason:'generation_not_found'}
 const writerId=generation?.ai_id||actor.id
 const existing=await env.DB.prepare('SELECT * FROM messages WHERE conversation_id=? AND project_id=? AND local_id=?').bind(conversationId,projectId,localId).first()
 if(existing){if(existing.actor_id!==writerId||existing.intent_hash!==intentHash) return {accepted:false,reason:'local_id_conflict'};return {accepted:true,duplicate:true,message:existing}}
 const citations=refs.length?await resolvePublicCitations(env,projectId,input.generationId!,refs):[]
 const messageId=crypto.randomUUID(),now=Date.now();const predicates=['c.id=?','c.project_id=?','c.revision=?'];const args:unknown[]=[conversationId,projectId,expectedRevision]
 if(input.generationId){predicates.push(`c.assigned_to IS NULL AND ${activeSourceProjectSql('c.project_id')}`)}else if(actor.role==='contact'){predicates.push("c.contact_id=? AND EXISTS(SELECT 1 FROM contacts contact WHERE contact.id=c.contact_id AND COALESCE(json_extract(contact.metadata_json,'$.is_blocked'),0)!=1)");args.push(actor.contactId||actor.id)}else{predicates.push('EXISTS(SELECT 1 FROM memberships WHERE project_id=c.project_id AND user_id=? AND role=?)');args.push(actor.id,actor.role)}
 if(input.expectedLastMessageId!==undefined){predicates.push('c.last_message_id IS ?');args.push(input.expectedLastMessageId)}
 if(mediaIds.length){predicates.push(`(SELECT COUNT(*) FROM media WHERE id IN (${mediaIds.map(()=>'?').join(',')}) AND project_id=c.project_id AND conversation_id=c.id AND message_id IS NULL AND uploaded_by=?)=?`);args.push(...mediaIds,actor.id,mediaIds.length)}
 if(input.generationId){predicates.push("EXISTS(SELECT 1 FROM ai_generations g WHERE g.id=? AND g.project_id=c.project_id AND g.conversation_id=c.id AND g.state='running' AND g.source_revision=c.revision AND (SELECT revision FROM context_subjects WHERE project_id=c.project_id AND subject_id=c.contact_id)=g.source_context_revision AND c.resolved_at IS NULL AND EXISTS(SELECT 1 FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id WHERE ca.conversation_id=c.id AND a.id=g.ai_id AND a.project_id=c.project_id AND a.is_enabled=1 AND a.model=json_extract(g.ai_profile_json,'$.model') AND a.prompt=json_extract(g.ai_profile_json,'$.prompt')))");args.push(input.generationId)}
 for(const citation of citations){const guard=citationAdmissionGuard(citation);predicates.push(guard.sql);args.push(...guard.args)}
 const citationColumns=citations.length?',citations_json':'',citationValues=citations.length?',?':''
 const statements=[env.DB.prepare(`INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at,intent_hash${citationColumns}) SELECT ?,c.project_id,c.id,?,?,?,?,c.revision+1,?,?${citationValues} FROM conversations c WHERE ${predicates.join(' AND ')} AND NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id=c.id AND local_id=?)`).bind(messageId,localId,writerId,input.generationId?'ai':actor.role,content,now,intentHash,...(citations.length?[JSON.stringify(citations)]:[]),...args,localId),env.DB.prepare('UPDATE conversations SET revision=revision+1,last_message_id=?,updated_at=?,resolved_at=?,assigned_to=CASE WHEN ? THEN ? ELSE assigned_to END WHERE id=? AND EXISTS(SELECT 1 FROM messages WHERE id=?)').bind(messageId,now,actor.role!=='contact'&&input.resolve?now:null,actor.role!=='contact'&&!input.generationId?1:0,actor.id,conversationId,messageId),env.DB.prepare('INSERT INTO conversation_outbox(project_id,conversation_id,message_id,created_at) SELECT project_id,conversation_id,id,created_at FROM messages WHERE id=?').bind(messageId)]
 if(mediaIds.length)statements.push(env.DB.prepare(`UPDATE media SET message_id=? WHERE id IN (${mediaIds.map(()=>'?').join(',')}) AND EXISTS(SELECT 1 FROM messages WHERE id=?)`).bind(messageId,...mediaIds,messageId))
 if(input.generationId)statements.push(env.DB.prepare("UPDATE ai_generations SET state='completed' WHERE id=? AND EXISTS(SELECT 1 FROM messages WHERE id=?)").bind(input.generationId,messageId))
 await env.DB.batch(statements)
 const message=await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(messageId).first()
 if(!message){const duplicate=await env.DB.prepare('SELECT * FROM messages WHERE conversation_id=? AND project_id=? AND local_id=?').bind(conversationId,projectId,localId).first();if(duplicate&&duplicate.actor_id===writerId&&duplicate.intent_hash===intentHash)return {accepted:true,duplicate:true,message:duplicate};return {accepted:false,reason:'conversation_changed_or_admission_denied'}}
 return {accepted:true,duplicate:false,message}
}
