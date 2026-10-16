import {assignmentHistoryStatement} from '../outcomes/assignment-history.ts'
import {inboundAuthority,type InboundAuthority} from '../integrations/inbound-authority.ts'
import {contactAvailableSql} from './contact-privacy.ts'
import {tokenGuard,type TokenAuthority} from '../../platform/integration-authority.ts'
import {authoringSource,authorshipStatement,type Authoring} from '../outcomes/provenance.ts'
import {trackingStatement} from '../outcomes/state.ts'
import {resolvePublicCitations,citationAdmissionGuard,activeSourceProjectSql,type PublicReference} from '../knowledge/public-sources.ts'
import type { Actor,Env } from '../../platform/env'
/** Local ids the server mints: `email:` identifies an inbound email claim and `erased:`
 * replaces a client-supplied id when its contact is erased (contact-erasure/statements.ts).
 * Clients may use neither. */
export const reservedLocalId=(localId:unknown)=>typeof localId==='string'&&/^(?:email|erased):/.test(localId)
export interface MessageInput {[inboundAuthority]?:InboundAuthority;projectId:string;conversationId:string;actor:Actor;localId:string;content:string;expectedRevision:number;expectedLastMessageId?:string|null;mediaIds?:string[];resolve?:boolean;generationId?:string;citations?:PublicReference[];authoring?:Authoring;sessionHash?:string;tokenAuthority?:TokenAuthority}
export async function admitMessage(env:Env,input:MessageInput){
 const {projectId,conversationId,actor,localId,content,expectedRevision}=input,email=input[inboundAuthority]
 if(actor.projectId!==projectId)throw new Error('Project access denied')
 if(!localId||localId.length>200||localId.startsWith('erased:')||typeof content!=='string'||content.length>100000||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('Invalid message command')
 if(input.citations?.length&&!input.generationId)throw new Error('Only finalized AI messages may cite knowledge')
 const refs=input.citations??[]
 if(!Array.isArray(refs)||refs.length>10||refs.some(r=>!r||typeof r.id!=='string'||typeof r.sourceVersion!=='string'))throw new Error('Invalid public citations')
 const mediaIds=[...new Set(input.mediaIds||[])];if(mediaIds.length>20||(!content.trim()&&!mediaIds.length))throw new Error('Invalid message content')
 const intentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({content,mediaIds:[...mediaIds].sort(),resolve:!!input.resolve,expectedRevision,expectedLastMessageId:input.expectedLastMessageId,generationId:input.generationId,...(refs.length?{citations:refs.map(r=>({id:r.id,sourceVersion:r.sourceVersion}))}: {})}))))).map(x=>x.toString(16).padStart(2,'0')).join('')
 const scope=await env.DB.prepare('SELECT c.contact_id,c.resolved_at,c.assigned_to,(SELECT MAX(ordinal) FROM conversation_resolutions WHERE conversation_id=c.id) ordinal FROM conversations c WHERE c.id=? AND c.project_id=?').bind(conversationId,projectId).first<{contact_id:string;resolved_at:number|null;assigned_to:string|null;ordinal:number|null}>()
 if(!scope||(!input.generationId&&actor.role==='contact'&&!email&&scope.contact_id!==(actor.contactId||actor.id)))return {accepted:false,reason:'conversation_access_denied'}
 if(!input.tokenAuthority&&!input.generationId&&actor.role!=='contact'&&!await env.DB.prepare('SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role=?').bind(projectId,actor.id,actor.role).first())return {accepted:false,reason:'conversation_access_denied'}
 const generation=input.generationId?await env.DB.prepare('SELECT ai_id FROM ai_generations WHERE id=? AND project_id=? AND conversation_id=?').bind(input.generationId,projectId,conversationId).first<{ai_id:string}>():null
 if(input.generationId&&!generation)return {accepted:false,reason:'generation_not_found'}
 const writerId=generation?.ai_id||actor.id
 const replayGuard=input.tokenAuthority?tokenGuard(input.tokenAuthority,projectId,'messages:write'):null
 const replayPredicate=replayGuard?`AND erased_at IS NULL AND EXISTS(${replayGuard.sql}) AND EXISTS(SELECT 1 FROM conversations c WHERE c.id=messages.conversation_id AND c.project_id=messages.project_id AND ${contactAvailableSql()})`:''
 const existing=await env.DB.prepare(`SELECT * FROM messages WHERE conversation_id=? AND project_id=? AND local_id=? ${replayPredicate}`).bind(conversationId,projectId,localId,...(replayGuard?.params||[])).first()
 if(existing){if(existing.actor_id!==writerId||existing.intent_hash!==intentHash) return {accepted:false,reason:'local_id_conflict'};return {accepted:true,duplicate:true,message:existing}}
 const authorship=await authoringSource(env,actor,conversationId,input.authoring,input.generationId)
 const citations=refs.length?await resolvePublicCitations(env,projectId,input.generationId!,refs):[]
 const messageId=crypto.randomUUID(),now=Date.now();const predicates=['c.id=?','c.project_id=?','c.revision=?','c.contact_id=?'];const args:unknown[]=[conversationId,projectId,expectedRevision,scope.contact_id]
 if(input.resolve&&!input.generationId){predicates.push('c.resolved_at IS ?','(SELECT MAX(ordinal) FROM conversation_resolutions WHERE conversation_id=c.id) IS ?');args.push(scope.resolved_at,scope.ordinal)}
 if(input.tokenAuthority){const guard=tokenGuard(input.tokenAuthority,projectId,'messages:write');predicates.push(`EXISTS(${guard.sql})`,contactAvailableSql());args.push(...guard.params)}else if(input.generationId){predicates.push(`c.assigned_to IS NULL AND ${activeSourceProjectSql('c.project_id')}`)}else if(actor.role==='contact'&&!email){predicates.push("c.contact_id=? AND EXISTS(SELECT 1 FROM contacts contact WHERE contact.id=c.contact_id AND COALESCE(json_extract(contact.metadata_json,'$.is_blocked'),0)!=1)");args.push(actor.contactId||actor.id)}else if(actor.role!=='contact'){predicates.push('EXISTS(SELECT 1 FROM memberships WHERE project_id=c.project_id AND user_id=? AND role=?)');args.push(actor.id,actor.role)}
 if(email){
  predicates.push(`EXISTS(SELECT 1 FROM inbound_emails receipt JOIN email_settings mailbox ON mailbox.project_id=receipt.project_id WHERE receipt.id=? AND receipt.project_id=c.project_id AND receipt.conversation_id=c.id AND receipt.claim_token=? AND receipt.state='processing' AND mailbox.is_enabled=1)`,activeSourceProjectSql('c.project_id'),contactAvailableSql())
  args.push(email.receiptId,email.claimToken)
  if(actor.role==='contact'){
   predicates.push(`EXISTS(SELECT 1 FROM contacts sender WHERE sender.id=? AND sender.project_id=c.project_id AND lower(sender.email)=? AND coalesce(json_extract(sender.metadata_json,'$.is_blocked'),0)!=1 AND coalesce(json_extract(sender.metadata_json,'$.is_deleted'),0)!=1 AND coalesce(json_extract(sender.metadata_json,'$.is_erased'),0)!=1 AND coalesce(json_extract(sender.metadata_json,'$.is_erasing'),0)!=1 AND (c.contact_id=sender.id OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id=c.id AND cp.contact_id=sender.id)))`)
   args.push(actor.id,email.sender)
  }else{
   predicates.push('EXISTS(SELECT 1 FROM memberships live JOIN users sender ON sender.id=live.user_id WHERE live.project_id=c.project_id AND live.user_id=? AND live.role=? AND lower(sender.email)=?)')
   args.push(actor.id,actor.role,email.sender)
  }
 }
 if(input.sessionHash){predicates.push(activeSourceProjectSql('c.project_id'));predicates.push("EXISTS(SELECT 1 FROM sessions s WHERE s.token_hash=? AND s.actor_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND (s.role='contact' AND s.project_id=c.project_id AND s.contact_id=c.contact_id OR s.role<>'contact' AND (s.project_id IS NULL AND s.role='operator' OR s.project_id=c.project_id AND EXISTS(SELECT 1 FROM memberships live WHERE live.project_id=s.project_id AND live.user_id=s.actor_id AND live.role=s.role))))");args.push(input.sessionHash,actor.id,now)}
 if(input.expectedLastMessageId!==undefined){predicates.push('c.last_message_id IS ?');args.push(input.expectedLastMessageId)}
 if(mediaIds.length){predicates.push(`(SELECT COUNT(*) FROM media WHERE id IN (${mediaIds.map(()=>'?').join(',')}) AND project_id=c.project_id AND conversation_id=c.id AND message_id IS NULL AND uploaded_by=?)=?`);args.push(...mediaIds,actor.id,mediaIds.length)}
 if(input.generationId){predicates.push("EXISTS(SELECT 1 FROM ai_generations g WHERE g.id=? AND g.project_id=c.project_id AND g.conversation_id=c.id AND g.state='running' AND g.source_revision=c.revision AND (SELECT revision FROM context_subjects WHERE project_id=c.project_id AND subject_id=c.contact_id)=g.source_context_revision AND c.resolved_at IS NULL AND EXISTS(SELECT 1 FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id WHERE ca.conversation_id=c.id AND a.id=g.ai_id AND a.project_id=c.project_id AND a.is_enabled=1 AND a.model=json_extract(g.ai_profile_json,'$.model') AND a.prompt=json_extract(g.ai_profile_json,'$.prompt')))");args.push(input.generationId)}
 if(authorship.guard){predicates.push(authorship.guard.sql);args.push(...authorship.guard.params)}
 for(const citation of citations){const guard=citationAdmissionGuard(citation);predicates.push(guard.sql);args.push(...guard.args)}
 const citationColumns=(citations.length?',citations_json':'')+(email?',content_raw':''),citationValues=(citations.length?',?':'')+(email?',?':'')
 const statements=[env.DB.prepare(`INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at,intent_hash${citationColumns}) SELECT ?,c.project_id,c.id,?,?,?,?,c.revision+1,?,?${citationValues} FROM conversations c WHERE ${predicates.join(' AND ')} AND NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id=c.id AND local_id=?)`).bind(messageId,localId,writerId,input.generationId?'ai':actor.role,content,now,intentHash,...(citations.length?[JSON.stringify(citations)]:[]),...(email?[email.raw]:[]),...args,localId),authorshipStatement(env,messageId,authorship,now),trackingStatement(env,conversationId,false,messageId),env.DB.prepare('UPDATE conversations SET revision=revision+1,last_message_id=?,updated_at=?,resolved_at=?,assigned_to=CASE WHEN ? THEN ? ELSE assigned_to END WHERE id=? AND EXISTS(SELECT 1 FROM messages WHERE id=?)').bind(messageId,now,actor.role!=='contact'&&input.resolve?now:null,actor.role!=='contact'&&!input.generationId&&!input.tokenAuthority?1:0,actor.id,conversationId,messageId),env.DB.prepare('INSERT INTO conversation_outbox(project_id,conversation_id,message_id,created_at) SELECT project_id,conversation_id,id,created_at FROM messages WHERE id=?').bind(messageId)]
 if(email?.cc.length)for(const contactId of email.cc)statements.push(env.DB.prepare(`INSERT OR IGNORE INTO conversation_participants(id,conversation_id,contact_id,created_at) SELECT ?,m.conversation_id,ct.id,? FROM messages m JOIN contacts ct ON ct.project_id=m.project_id WHERE m.id=? AND ct.id=? AND coalesce(json_extract(ct.metadata_json,'$.is_blocked'),0)!=1 AND coalesce(json_extract(ct.metadata_json,'$.is_erased'),0)!=1 AND coalesce(json_extract(ct.metadata_json,'$.is_erasing'),0)!=1`).bind(crypto.randomUUID(),now,messageId,contactId))
 if(actor.role!=='contact'&&!input.generationId&&!input.tokenAuthority&&scope.assigned_to!==actor.id)statements.push(assignmentHistoryStatement(env,{id:`message:${messageId}`,conversationId,actorId:actor.id,agentId:actor.id,createdAt:now},'EXISTS(SELECT 1 FROM messages WHERE id=?)',[messageId]))
 if(actor.role!=='contact'&&!input.generationId)statements.push(env.DB.prepare("UPDATE ai_generations SET state='cancelled',updated_at=? WHERE conversation_id=? AND project_id=? AND state IN ('queued','running') AND EXISTS(SELECT 1 FROM messages WHERE id=?)").bind(new Date(now).toISOString(),conversationId,projectId,messageId))
 if(mediaIds.length)statements.push(env.DB.prepare(`UPDATE media SET message_id=? WHERE id IN (${mediaIds.map(()=>'?').join(',')}) AND EXISTS(SELECT 1 FROM messages WHERE id=?)`).bind(messageId,...mediaIds,messageId))
 if(input.generationId)statements.push(env.DB.prepare("UPDATE ai_generations SET state='completed' WHERE id=? AND EXISTS(SELECT 1 FROM messages WHERE id=?)").bind(input.generationId,messageId))
 await env.DB.batch(statements)
 const message=await env.DB.prepare(`SELECT * FROM messages WHERE id=? ${replayPredicate}`).bind(messageId,...(replayGuard?.params||[])).first()
 if(!message){const duplicate=await env.DB.prepare(`SELECT * FROM messages WHERE conversation_id=? AND project_id=? AND local_id=? ${replayPredicate}`).bind(conversationId,projectId,localId,...(replayGuard?.params||[])).first();if(duplicate&&duplicate.actor_id===writerId&&duplicate.intent_hash===intentHash)return {accepted:true,duplicate:true,message:duplicate};return {accepted:false,reason:'conversation_changed_or_admission_denied'}}
 return {accepted:true,duplicate:false,message}
}
