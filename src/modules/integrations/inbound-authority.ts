import type {Actor,Env} from '../../platform/env'
import {HTTPException} from 'hono/http-exception'
import {id} from '../../platform/db'
import {contactWritable} from '../../platform/contact-state'
import {inboundTarget} from './inbound-routing'

// A Symbol cannot arrive in a public JSON message command. Admission rechecks the
// receipt and sender authority in the transaction that commits the message.
export const inboundAuthority=Symbol('authenticated inbound email')
export interface InboundAuthority {sender:string;receiptId:string;claimToken:string;raw:string;cc:string[]}
const available=`${contactWritable} AND coalesce(json_extract(metadata_json,'$.is_blocked'),0)!=1 AND coalesce(json_extract(metadata_json,'$.is_deleted'),0)!=1`

export async function emailContact(env:Env,projectId:string,email:string){
 const read=async()=>(await env.DB.prepare('SELECT * FROM contacts WHERE project_id=? AND lower(email)=? LIMIT 2').bind(projectId,email).all<any>()).results
 let contacts=await read()
 if(!contacts.length){
  await env.DB.prepare('INSERT INTO contacts(id,project_id,email,created_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM contacts WHERE project_id=? AND lower(email)=?)').bind(id(),projectId,email,Date.now(),projectId,email).run()
  contacts=await read()
 }
 if(contacts.length!==1)throw new HTTPException(409,{message:'Ambiguous email identity'})
 if(!await env.DB.prepare(`SELECT id FROM contacts WHERE id=? AND project_id=? AND ${available}`).bind(contacts[0].id,projectId).first())throw new HTTPException(403,{message:'Contact is unavailable'})
 return contacts[0]
}

export async function emailActor(env:Env,projectId:string,conversation:any,sender:string):Promise<Actor>{
 const members=(await env.DB.prepare('SELECT u.id,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=? LIMIT 2').bind(projectId,sender).all<{id:string;role:Actor['role']}>()).results
 const contacts=(await env.DB.prepare(`SELECT ct.id FROM contacts ct WHERE ct.project_id=? AND lower(ct.email)=? AND (ct.id=? OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id=? AND cp.contact_id=ct.id))`).bind(projectId,sender,conversation.contact_id,conversation.id).all<{id:string}>()).results
 if(members.length+contacts.length!==1)throw new HTTPException(403,{message:'Sender is not an unambiguous current conversation participant or workspace member'})
 if(members[0])return {id:members[0].id,role:members[0].role,projectId}
 return {id:contacts[0].id,contactId:contacts[0].id,role:'contact',projectId}
}

/** Bare mailbox policy: one open primary-contact thread continues. Closed history
 * starts a new thread; multiple open threads require a conversation reply address. */
export async function openEmailConversation(env:Env,projectId:string,contactId:string){
 const rows=(await env.DB.prepare('SELECT * FROM conversations WHERE project_id=? AND contact_id=? AND resolved_at IS NULL ORDER BY updated_at DESC LIMIT 2').bind(projectId,contactId).all<any>()).results
 if(rows.length>1)throw new HTTPException(409,{message:'More than one open conversation; reply to its conversation address'})
 return rows[0]||null
}

export async function ccContacts(env:Env,projectId:string,conversation:any,addresses:string[],sender:string,mailbox:string){
 const contacts:string[]=[]
 for(const address of addresses){
  if(address===sender||inboundTarget(address)?.mailbox===mailbox)continue
  if(await env.DB.prepare('SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=?').bind(projectId,address).first())continue
  const contact=await emailContact(env,projectId,address)
  if(contact.id!==conversation.contact_id)contacts.push(contact.id)
 }
 return contacts
}
