import {trackingStatement} from '../outcomes/state'
import {HTTPException} from 'hono/http-exception'
import type {Actor,Env} from '../../platform/env'
import {id,requiredString} from '../../platform/db'
import {hashToken} from '../../platform/auth'
import {admitMessage} from '../conversations/admission'
import {emailAddress,inboundTarget} from './inbound-routing'
import {inboundLocalId,legacyInboundLocalId,scopedInboundId} from './inbound-identity'
import {visibleEmailReply} from './email-reply'
import {replyGrant} from './email-reply-address'
import {inboundAuthority,emailContact,emailActor,preferredAddressActor,openEmailConversation,ccContacts} from './inbound-authority'
import {classifyInboundEmail,evidenceJson,type EmailEvidence} from './email-classification'
/** `to` lists the recipient addresses in routing order (envelope, forwarding headers,
 * To); the first configured mailbox selects the project. `from` is the header From and
 * `senderAuthenticated` whether the ingress verified it. `replyTo` is a reply target
 * only. `evidence` is what the ingress retained for automatic-mail classification. It
 * is not part of the delivery identity, so a redelivery keeps its first classification. */
export interface IncomingEmail {messageId:string;to:string|readonly string[];from:string;text:string;conversationId?:string;cc?:string[];replyTo?:string;senderAuthenticated?:boolean;evidence?:EmailEvidence;attachments?:{filename:string;contentType:string;content:ArrayBuffer}[]}
const enabledMailbox="SELECT e.project_id,lower(e.from_address) from_address FROM email_settings e WHERE lower(e.inbound_address)=? AND e.is_enabled=1 AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=e.project_id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL)"
async function receivingMailbox(env:Env,candidates:string[]){
 for(const candidate of candidates){
  const target=inboundTarget(candidate);if(!target)continue
  const project=await env.DB.prepare(enabledMailbox).bind(target.mailbox).first<{project_id:string;from_address:string|null}>()
  if(project)return {project,target}
 }
 return null
}
export async function receiveEmail(env:Env,input:IncomingEmail){
 const recipients=(Array.isArray(input.to)?input.to:[input.to]) as unknown[]
 if(!recipients.length||recipients.length>50)throw new HTTPException(400,{message:'Inbound email address is invalid'})
 const messageId=requiredString(input.messageId,'messageId',200),to=recipients.map(value=>emailAddress(requiredString(value,'to',320))),from=emailAddress(requiredString(input.from,'from',320)),raw=typeof input.text==='string'?input.text.slice(0,100000):undefined;if(raw===undefined)throw new HTTPException(400,{message:'Invalid text'})
 if(!from||to.some(address=>!address))throw new HTTPException(400,{message:'Inbound email address is invalid'})
 if(!Array.isArray(input.cc||[]))throw new HTTPException(400,{message:'Invalid CC recipients'})
 // Malformed or excess CC entries are skipped, never a reason to refuse the message.
 let content=visibleEmailReply(raw);const cc=[...new Set((input.cc||[]).map(value=>emailAddress(value)).filter((value):value is string=>Boolean(value)))].sort().slice(0,20)
 const received=await receivingMailbox(env,[...to as string[],...cc]);if(!received)throw new HTTPException(404,{message:'Inbound mailbox is not configured'})
 const {project,target}=received,authenticated=input.senderAuthenticated!==false
 if(input.conversationId&&target.conversationId&&input.conversationId!==target.conversationId)throw new HTTPException(400,{message:'Conflicting conversation address'})
 const grant=target.replyToken?await replyGrant(env,project.project_id,target.replyToken):null
 if(input.conversationId&&grant&&input.conversationId!==grant.conversation_id)throw new HTTPException(400,{message:'Conflicting conversation address'})
 const addressed=grant?.conversation_id||input.conversationId||target.conversationId||undefined
 // Files past the per-message limits are named in the message instead of refusing it.
 const offered=input.attachments||[],attachments=offered.filter(f=>f.content.byteLength<=20000000).slice(0,20),omitted=offered.filter(f=>!attachments.includes(f)).map(f=>f.filename)
 if(omitted.length)content=[content,`(Not kept, over the 20 MB or 20-file email limit: ${omitted.join(', ')})`].filter(Boolean).join('\n\n')
 if(!content.trim()&&!attachments.length)throw new HTTPException(400,{message:'Invalid message content'})
 const hashes=await Promise.all(attachments.map(async f=>({filename:f.filename,type:f.contentType,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',f.content))).map(x=>x.toString(16).padStart(2,'0')).join('')})))
 const intentHash=await hashToken(JSON.stringify({to:target.mailbox,from,content:raw,conversationId:addressed||null,attachments:hashes,...(cc.length?{cc}:{})})),localId=await inboundLocalId(project.project_id,messageId),legacyLocalId=await legacyInboundLocalId(messageId),scopedId=await scopedInboundId(project.project_id,messageId)
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
 const automatic=classified?classified.automatic:Boolean(prior.automatic),evidence=classified&&input.evidence?evidenceJson({...input.evidence,sender_verified:authenticated},classified):null
 const claimToken=id(),claimed=prior
  ?await env.DB.prepare("UPDATE inbound_emails SET state='processing',error=NULL,claim_token=?,automatic=CASE WHEN local_id IS NULL THEN ? ELSE automatic END,evidence_json=CASE WHEN local_id IS NULL THEN ? ELSE evidence_json END,local_id=coalesce(local_id,?) WHERE id=? AND state='failed'").bind(claimToken,automatic?1:0,evidence,localId,recordId).run()
  :await env.DB.prepare("INSERT OR IGNORE INTO inbound_emails(id,project_id,conversation_id,intent_hash,state,error,created_at,claim_token,automatic,evidence_json,local_id) VALUES(?,?,NULL,?,'processing',NULL,?,?,?,?,?)").bind(recordId,project.project_id,intentHash,Date.now(),claimToken,automatic?1:0,evidence,localId).run()
 if(!claimed.meta.changes)throw new HTTPException(409,{message:'Inbound email is already processing'})
 try{
  // Workspace addresses the mail was routed through never become participants.
  const workspace=new Set<string>([from,target.mailbox,...to as string[],...(project.from_address?[project.from_address]:[]),...cc.filter(address=>inboundTarget(address)?.mailbox===target.mailbox)])
  // An addressed thread admits its current participants and members. A reply address
  // issued to this sender is possession proof; otherwise member authority, and any
  // authority through somebody else's reply address, needs an authenticated From.
  let conversation:any=null,actor:Actor|null=null
  const possessed=Boolean(grant&&grant.recipient===from),trusted=possessed||authenticated
  const addressedConversation=addressed?await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND project_id=?').bind(addressed,project.project_id).first<any>():null
  if(addressedConversation&&(trusted||!grant)){
   actor=await emailActor(env,project.project_id,addressedConversation,from,trusted)||(possessed?await preferredAddressActor(env,project.project_id,addressedConversation,from):null)
   if(actor)conversation=addressedConversation
  }
  // Everything else is the sender's own mail to the support mailbox: it continues
  // their most recently active open thread or starts one, and is never refused.
  if(!actor){
   const contact=await emailContact(env,project.project_id,from)
   if(!contact){
    await env.DB.prepare("UPDATE inbound_emails SET state='ignored',error='Contact is unavailable' WHERE id=? AND claim_token=?").bind(recordId,claimToken).run()
    return {id:messageId,state:'ignored',conversationId:null,duplicate:false,automatic}
   }
   actor={id:contact.id,contactId:contact.id,projectId:project.project_id,role:'contact'}
   conversation=(prior?.conversation_id?await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND project_id=? AND contact_id=?').bind(prior.conversation_id,project.project_id,contact.id).first<any>():null)||await openEmailConversation(env,project.project_id,contact.id)
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
  // CC recipients become participants atomically with message admission, only for a
  // sender whose identity or reply address is proven; otherwise they are skipped.
  const participants=automatic||!trusted?[]:await ccContacts(env,project.project_id,conversation,cc,workspace)
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
  await keepReplyTarget(env,project.project_id,actor,input.replyTo,{authenticated,automatic,workspace})
  return {id:messageId,state:'delivered',conversationId:conversation.id,duplicate:false,automatic,message:result.message,actor}
 }catch(error){await env.DB.prepare("UPDATE inbound_emails SET state='failed',error=? WHERE id=? AND state='processing'").bind(String(error).slice(0,1000),recordId).run();throw error}
}
/** An authenticated contact's Reply-To becomes where replies to them are sent (their
 * preferred notification address). It never changes who they are. */
async function keepReplyTarget(env:Env,projectId:string,actor:Actor,value:unknown,context:{authenticated:boolean;automatic:boolean;workspace:ReadonlySet<string>}){
 const replyTo=emailAddress(value)
 if(!replyTo||actor.role!=='contact'||!context.authenticated||context.automatic||context.workspace.has(replyTo)||inboundTarget(replyTo)&&await env.DB.prepare('SELECT 1 FROM email_settings WHERE lower(inbound_address)=?').bind(inboundTarget(replyTo)!.mailbox).first())return
 await env.DB.prepare(`UPDATE contacts SET metadata_json=json_set(coalesce(metadata_json,'{}'),'$.provided_email',?) WHERE id=? AND project_id=? AND coalesce(json_extract(metadata_json,'$.is_erasing'),0)!=1 AND coalesce(json_extract(metadata_json,'$.is_erased'),0)!=1
  AND NOT EXISTS(SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=?)`).bind(replyTo,actor.contactId,projectId,projectId,replyTo).run()
}
