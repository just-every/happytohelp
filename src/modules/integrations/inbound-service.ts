import {trackingStatement} from '../outcomes/state'
import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import {id,requiredString} from '../../platform/db'
import {hashToken} from '../../platform/auth'
import {admitMessage} from '../conversations/admission'
import {emailAddress,inboundTarget} from './inbound-routing'
import {inboundLocalId,legacyInboundLocalId,scopedInboundId} from './inbound-identity'
import {visibleEmailReply} from './email-reply'
import {resolveReplyRecipient} from './email-reply-address'
import {inboundAuthority,emailContact,emailActor,openEmailConversation,ccContacts} from './inbound-authority'
import {classifyInboundEmail,evidenceJson,type EmailEvidence} from './email-classification'
/** `evidence` is what the ingress retained for automatic-mail classification. It is
 * not part of the delivery identity, so a redelivery keeps its first classification. */
export interface IncomingEmail {messageId:string;to:string;from:string;text:string;conversationId?:string;cc?:string[];senderAuthenticated?:boolean;evidence?:EmailEvidence;attachments?:{filename:string;contentType:string;content:ArrayBuffer}[]}
export async function receiveEmail(env:Env,input:IncomingEmail){
 const messageId=requiredString(input.messageId,'messageId',200),to=inboundTarget(requiredString(input.to,'to',320)),from=emailAddress(requiredString(input.from,'from',320)),raw=typeof input.text==='string'?input.text:undefined;if(raw===undefined||raw.length>100000)throw new HTTPException(400,{message:'Invalid text'});if(!to||!from)throw new HTTPException(400,{message:'Inbound email address is invalid'});const project=await env.DB.prepare("SELECT e.project_id FROM email_settings e WHERE lower(e.inbound_address)=? AND e.is_enabled=1 AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=e.project_id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL)").bind(to.mailbox).first<{project_id:string}>();if(!project)throw new HTTPException(404,{message:'Inbound mailbox is not configured'})
 if(!Array.isArray(input.cc||[]))throw new HTTPException(400,{message:'Invalid CC recipients'});const content=visibleEmailReply(raw),cc=[...new Set((input.cc||[]).map(value=>emailAddress(value)))].sort();if(cc.length>20||cc.some(address=>!address))throw new HTTPException(400,{message:'Invalid CC recipients'});if(input.conversationId&&to.conversationId&&input.conversationId!==to.conversationId)throw new HTTPException(400,{message:'Conflicting conversation address'})
 const grant=to.replyToken?await resolveReplyRecipient(env,project.project_id,to.replyToken,from):null
 if(to.replyToken&&(!grant||input.conversationId&&input.conversationId!==grant.conversation_id))throw new HTTPException(403,{message:'Reply address is not authorized for this sender'})
 if(cc.length&&input.senderAuthenticated===false&&!grant)throw new HTTPException(403,{message:'Adding email recipients requires a recipient reply address or sender-authenticated gateway'})
 input={...input,to:to.mailbox,from,conversationId:grant?.conversation_id||input.conversationId||to.conversationId||undefined};const attachments=input.attachments||[];if(attachments.length>20||attachments.some(f=>f.content.byteLength>20000000))throw new HTTPException(413);if(!content.trim()&&!attachments.length)throw new HTTPException(400,{message:'Invalid message content'})
 const hashes=await Promise.all(attachments.map(async f=>({filename:f.filename,type:f.contentType,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',f.content))).map(x=>x.toString(16).padStart(2,'0')).join('')})))
 const intentHash=await hashToken(JSON.stringify({to:to.mailbox,from,content:raw,conversationId:input.conversationId||null,attachments:hashes,...(cc.length?{cc}:{})})),localId=await inboundLocalId(project.project_id,messageId),legacyLocalId=await legacyInboundLocalId(messageId),scopedId=await scopedInboundId(project.project_id,messageId)
 const rawPrior=await env.DB.prepare('SELECT id,project_id FROM inbound_emails WHERE id=?').bind(messageId).first<{id:string;project_id:string}>()
 const prior=rawPrior?.project_id===project.project_id
  ?await env.DB.prepare('SELECT * FROM inbound_emails WHERE id=? AND project_id=?').bind(messageId,project.project_id).first<any>()
  :await env.DB.prepare('SELECT * FROM inbound_emails WHERE id=? AND project_id=?').bind(scopedId,project.project_id).first<any>()
 const recordId=prior?.id||(rawPrior&&rawPrior.project_id!==project.project_id?scopedId:messageId)
 if(prior){
  if(prior.project_id!==project.project_id||prior.intent_hash!==intentHash)throw new HTTPException(409,{message:'Inbound email identity conflict'})
  // Admission and its outbox are atomic. Reconcile a lost completion write without
  // re-entering customer-message automation or replaying uncertain provider work.
  const admitted=await env.DB.prepare('SELECT id,conversation_id FROM messages WHERE project_id=? AND local_id IN (?,?) AND (? IS NULL OR conversation_id=?)').bind(project.project_id,localId,legacyLocalId,prior.conversation_id,prior.conversation_id).first<{id:string;conversation_id:string}>()
  if(admitted){
   await env.DB.prepare("UPDATE inbound_emails SET state='delivered',conversation_id=?,message_id=?,error=NULL WHERE id=?").bind(admitted.conversation_id,admitted.id,recordId).run()
   return {id:messageId,state:'delivered',conversationId:admitted.conversation_id,duplicate:true,automatic:Boolean(prior.automatic)}
  }
  if(prior.state!=='failed')return {id:messageId,state:prior.state,conversationId:prior.conversation_id,duplicate:true,automatic:Boolean(prior.automatic)}
 }
 // Classified once, before admission, so the committed message and its outbox can
 // never exist without the classification that suppresses its effects. A receipt
 // written before classification existed (no local_id) is classified on this claim.
 const classified=prior?.local_id!=null?null:input.evidence?classifyInboundEmail(input.evidence):{automatic:false,reasons:[]}
 const automatic=classified?classified.automatic:Boolean(prior.automatic),evidence=classified&&input.evidence?evidenceJson(input.evidence,classified):null
 const claimToken=id(),claimed=prior
  ?await env.DB.prepare("UPDATE inbound_emails SET state='processing',error=NULL,claim_token=?,automatic=CASE WHEN local_id IS NULL THEN ? ELSE automatic END,evidence_json=CASE WHEN local_id IS NULL THEN ? ELSE evidence_json END,local_id=coalesce(local_id,?) WHERE id=? AND state='failed'").bind(claimToken,automatic?1:0,evidence,localId,recordId).run()
  :await env.DB.prepare("INSERT OR IGNORE INTO inbound_emails(id,project_id,conversation_id,intent_hash,state,error,created_at,claim_token,automatic,evidence_json,local_id) VALUES(?,?,NULL,?,'processing',NULL,?,?,?,?,?)").bind(recordId,project.project_id,intentHash,Date.now(),claimToken,automatic?1:0,evidence,localId).run()
 if(!claimed.meta.changes)throw new HTTPException(409,{message:'Inbound email is already processing'})
 try{
  const conversationId=prior?.conversation_id||input.conversationId
  let conversation=conversationId?await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND project_id=?').bind(conversationId,project.project_id).first<any>():null
  if(conversationId&&!conversation)throw new HTTPException(403)
  let actor
  if(conversation){
   if(input.senderAuthenticated===false&&!grant)throw new HTTPException(403,{message:'Use the recipient reply address or a sender-authenticated gateway'})
   actor=await emailActor(env,project.project_id,conversation,from)
  }
  else{
   const contact=await emailContact(env,project.project_id,from)
   if(input.senderAuthenticated===false&&contact.is_verified===1)throw new HTTPException(403,{message:'Verified customers must use their recipient reply address'})
   conversation=await openEmailConversation(env,project.project_id,contact.id)
   if(conversation&&input.senderAuthenticated===false&&!grant)throw new HTTPException(403,{message:'Continue using the recipient reply address or a sender-authenticated gateway'})
   actor={id:contact.id,contactId:contact.id,projectId:project.project_id,role:'contact' as const}
   if(!conversation){
    const key=id(),now=Date.now()
    await env.DB.batch([
     env.DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM conversations WHERE project_id=? AND contact_id=? AND resolved_at IS NULL)').bind(key,project.project_id,contact.id,now,now,project.project_id,contact.id),
     env.DB.prepare('UPDATE inbound_emails SET conversation_id=? WHERE id=? AND EXISTS(SELECT 1 FROM conversations WHERE id=? AND project_id=?)').bind(key,recordId,key,project.project_id),
     trackingStatement(env,key,true),
    ])
    conversation=await openEmailConversation(env,project.project_id,contact.id)
   }
  }
  await env.DB.prepare('UPDATE inbound_emails SET conversation_id=? WHERE id=?').bind(conversation.id,recordId).run()
  // CC recipients become participants atomically with message admission.
  const participants=automatic?[]:await ccContacts(env,project.project_id,conversation,cc as string[],from,to.mailbox)
  const mediaIds:string[]=[]
  for(const [index,file] of attachments.entries()){
   // Stable identities make interrupted local R2/D1 staging repeatable.
   const key=await hashToken(`${project.project_id}:${messageId}:${index}`),objectKey=`${project.project_id}/${conversation.id}/${key}`
   await env.FILES.put(objectKey,file.content,{httpMetadata:{contentType:file.contentType}})
   await env.DB.prepare('INSERT OR IGNORE INTO media(id,project_id,conversation_id,uploaded_by,object_key,filename,content_type,size,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(key,project.project_id,conversation.id,actor.id,objectKey,file.filename,file.contentType,file.content.byteLength,Date.now()).run()
   mediaIds.push(key)
  }
  const result=await admitMessage(env,{projectId:project.project_id,conversationId:conversation.id,actor,localId,content,expectedRevision:conversation.revision,expectedLastMessageId:conversation.last_message_id,mediaIds,[inboundAuthority]:{sender:from,receiptId:recordId,claimToken,raw,cc:participants}})
  if(!result.accepted)throw new Error(result.reason)
  await env.DB.prepare("UPDATE inbound_emails SET state='delivered',message_id=?,error=NULL WHERE id=?").bind(String(result.message!.id),recordId).run()
  return {id:messageId,state:'delivered',conversationId:conversation.id,duplicate:false,automatic,message:result.message,actor}
 }catch(error){await env.DB.prepare("UPDATE inbound_emails SET state='failed',error=? WHERE id=? AND state='processing'").bind(String(error).slice(0,1000),recordId).run();throw error}
}
