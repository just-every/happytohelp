import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import {id,requiredString} from '../../platform/db'
import {hashToken} from '../../platform/auth'
import {admitMessage} from '../conversations/admission'
import {emailAddress,inboundTarget} from './inbound-routing'
import {inboundLocalId,legacyInboundLocalId,scopedInboundId} from './inbound-identity'
export interface IncomingEmail {messageId:string;to:string;from:string;text:string;conversationId?:string;attachments?:{filename:string;contentType:string;content:ArrayBuffer}[]}
export async function receiveEmail(env:Env,input:IncomingEmail){
 const messageId=requiredString(input.messageId,'messageId',200),to=inboundTarget(requiredString(input.to,'to',320)),from=emailAddress(requiredString(input.from,'from',320)),content=typeof input.text==='string'?input.text:undefined;if(content===undefined||content.length>100000)throw new HTTPException(400,{message:'Invalid text'});if(!to||!from)throw new HTTPException(400,{message:'Inbound email address is invalid'});const project=await env.DB.prepare('SELECT project_id FROM email_settings WHERE lower(inbound_address)=? AND is_enabled=1').bind(to.mailbox).first<{project_id:string}>();if(!project)throw new HTTPException(404,{message:'Inbound mailbox is not configured'})
 input={...input,to:to.mailbox,from,conversationId:input.conversationId||to.conversationId||undefined};const attachments=input.attachments||[];if(attachments.length>20||attachments.some(f=>f.content.byteLength>20000000))throw new HTTPException(413);if(!content.trim()&&!attachments.length)throw new HTTPException(400,{message:'Invalid message content'})
 const hashes=await Promise.all(attachments.map(async f=>({filename:f.filename,type:f.contentType,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',f.content))).map(x=>x.toString(16).padStart(2,'0')).join('')})))
 const intentHash=await hashToken(JSON.stringify({to:to.mailbox,from,content,conversationId:input.conversationId||null,attachments:hashes})),localId=await inboundLocalId(project.project_id,messageId),legacyLocalId=await legacyInboundLocalId(messageId),scopedId=await scopedInboundId(project.project_id,messageId)
 const rawPrior=await env.DB.prepare('SELECT id,project_id FROM inbound_emails WHERE id=?').bind(messageId).first<{id:string;project_id:string}>()
 const prior=rawPrior?.project_id===project.project_id
  ?await env.DB.prepare('SELECT * FROM inbound_emails WHERE id=? AND project_id=?').bind(messageId,project.project_id).first<any>()
  :await env.DB.prepare('SELECT * FROM inbound_emails WHERE id=? AND project_id=?').bind(scopedId,project.project_id).first<any>()
 const recordId=prior?.id||(rawPrior&&rawPrior.project_id!==project.project_id?scopedId:messageId)
 if(prior){
  if(prior.project_id!==project.project_id||prior.intent_hash!==intentHash)throw new HTTPException(409,{message:'Inbound email identity conflict'})
  // Admission and its outbox are atomic. Reconcile a lost completion write without
  // re-entering customer-message automation or replaying uncertain provider work.
  const admitted=await env.DB.prepare('SELECT conversation_id FROM messages WHERE project_id=? AND local_id IN (?,?) AND (? IS NULL OR conversation_id=?)').bind(project.project_id,localId,legacyLocalId,prior.conversation_id,prior.conversation_id).first<{conversation_id:string}>()
  if(admitted){
   await env.DB.prepare("UPDATE inbound_emails SET state='delivered',conversation_id=?,error=NULL WHERE id=?").bind(admitted.conversation_id,recordId).run()
   return {id:messageId,state:'delivered',conversationId:admitted.conversation_id,duplicate:true}
  }
  if(prior.state!=='failed')return {id:messageId,state:prior.state,conversationId:prior.conversation_id,duplicate:true}
 }
 const claimToken=id(),claimed=prior
  ?await env.DB.prepare("UPDATE inbound_emails SET state='processing',error=NULL,claim_token=? WHERE id=? AND state='failed'").bind(claimToken,recordId).run()
  :await env.DB.prepare("INSERT OR IGNORE INTO inbound_emails(id,project_id,conversation_id,intent_hash,state,error,created_at,claim_token) VALUES(?,?,NULL,?,'processing',NULL,?,?)").bind(recordId,project.project_id,intentHash,Date.now(),claimToken).run()
 if(!claimed.meta.changes)throw new HTTPException(409,{message:'Inbound email is already processing'})
 try{
  let contact=await env.DB.prepare('SELECT id FROM contacts WHERE project_id=? AND lower(email)=?').bind(project.project_id,from).first<{id:string}>()
  if(!contact){contact={id:id()};await env.DB.prepare('INSERT INTO contacts(id,project_id,email,created_at) VALUES(?,?,?,?)').bind(contact.id,project.project_id,from,Date.now()).run()}
  const conversationId=prior?.conversation_id||input.conversationId
  let conversation=conversationId?await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND project_id=? AND contact_id=?').bind(conversationId,project.project_id,contact.id).first<any>():null
  if(conversationId&&!conversation)throw new HTTPException(403)
  if(!conversation){
   const key=id(),now=Date.now()
   await env.DB.batch([
    env.DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind(key,project.project_id,contact.id,now,now),
    env.DB.prepare('UPDATE inbound_emails SET conversation_id=? WHERE id=?').bind(key,recordId),
   ])
   conversation={id:key,revision:0,last_message_id:null}
  }else await env.DB.prepare('UPDATE inbound_emails SET conversation_id=? WHERE id=?').bind(conversation.id,recordId).run()
  const mediaIds:string[]=[]
  for(const [index,file] of attachments.entries()){
   // Stable identities make interrupted local R2/D1 staging repeatable.
   const key=await hashToken(`${project.project_id}:${messageId}:${index}`),objectKey=`${project.project_id}/${conversation.id}/${key}`
   await env.FILES.put(objectKey,file.content,{httpMetadata:{contentType:file.contentType}})
   await env.DB.prepare('INSERT OR IGNORE INTO media(id,project_id,conversation_id,uploaded_by,object_key,filename,content_type,size,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(key,project.project_id,conversation.id,contact.id,objectKey,file.filename,file.contentType,file.content.byteLength,Date.now()).run()
   mediaIds.push(key)
  }
  const actor={id:contact.id,contactId:contact.id,projectId:project.project_id,role:'contact' as const},result=await admitMessage(env,{projectId:project.project_id,conversationId:conversation.id,actor,localId,content,expectedRevision:conversation.revision,expectedLastMessageId:conversation.last_message_id,mediaIds})
  if(!result.accepted)throw new Error(result.reason)
  await env.DB.prepare("UPDATE inbound_emails SET state='delivered',error=NULL WHERE id=?").bind(recordId).run()
  return {id:messageId,state:'delivered',conversationId:conversation.id,duplicate:false,message:result.message,actor}
 }catch(error){await env.DB.prepare("UPDATE inbound_emails SET state='failed',error=? WHERE id=? AND state='processing'").bind(String(error).slice(0,1000),recordId).run();throw error}
}
