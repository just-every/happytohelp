import type {Actor,Env} from '../../platform/env.ts'
import {id} from '../../platform/db.ts'
import {contactWritable} from '../../platform/contact-state.ts'

// A Symbol cannot arrive in a public JSON message command. Admission rechecks the
// receipt and sender authority in the transaction that commits the message.
export const inboundAuthority=Symbol('authenticated inbound email')
export interface InboundAuthority {sender:string;receiptId:string;claimToken:string;raw:string;cc:string[]}
const availableAs=(alias:string)=>`${contactWritable.replaceAll('metadata_json',`${alias}.metadata_json`)} AND coalesce(json_extract(${alias}.metadata_json,'$.is_blocked'),0)!=1 AND coalesce(json_extract(${alias}.metadata_json,'$.is_deleted'),0)!=1`,available=availableAs('contacts')

/** The project's contact for a sender address, created on first mail. Retained
 * history may hold two contacts with one address; the earliest keeps the mail, as
 * legacy did. A blocked, deleted or erased contact receives nothing (null). */
export async function emailContact(env:Env,projectId:string,email:string){
 const read=()=>env.DB.prepare('SELECT * FROM contacts WHERE project_id=? AND lower(email)=? ORDER BY created_at,id LIMIT 1').bind(projectId,email).first<any>()
 let contact=await read()
 if(!contact){
  await env.DB.prepare('INSERT INTO contacts(id,project_id,email,created_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM contacts WHERE project_id=? AND lower(email)=?)').bind(id(),projectId,email,Date.now(),projectId,email).run()
  contact=await read()
 }
 if(!contact||!await env.DB.prepare(`SELECT id FROM contacts WHERE id=? AND project_id=? AND ${available}`).bind(contact.id,projectId).first())return null
 return contact
}

/** The current participant or workspace member a sender address names in this
 * conversation, or null. Member authority needs `members`: an authenticated From
 * or possession of that member's reply address. */
export async function emailActor(env:Env,projectId:string,conversation:any,sender:string,members:boolean):Promise<Actor|null>{
 const people=members?(await env.DB.prepare('SELECT u.id,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=? LIMIT 2').bind(projectId,sender).all<{id:string;role:Actor['role']}>()).results:[]
 const contacts=(await env.DB.prepare(`SELECT ct.id FROM contacts ct WHERE ct.project_id=? AND lower(ct.email)=? AND ${availableAs('ct')} AND (ct.id=? OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id=? AND cp.contact_id=ct.id))`).bind(projectId,sender,conversation.contact_id,conversation.id).all<{id:string}>()).results
 if(people.length+contacts.length!==1)return null
 if(people[0])return {id:people[0].id,role:people[0].role,projectId}
 return {id:contacts[0].id,contactId:contacts[0].id,role:'contact',projectId}
}

/** A reply from the primary contact's preferred notification address, through the
 * reply address issued to that preference, is the primary contact's own reply. */
export async function preferredAddressActor(env:Env,projectId:string,conversation:any,sender:string):Promise<Actor|null>{
 const contact=await env.DB.prepare(`SELECT id FROM contacts WHERE id=? AND project_id=? AND lower(json_extract(metadata_json,'$.provided_email'))=? AND ${available}`).bind(conversation.contact_id,projectId,sender).first<{id:string}>()
 return contact?{id:contact.id,contactId:contact.id,role:'contact',projectId}:null
}

/** Bare mailbox policy: a fresh email continues the contact's most recently active
 * open thread; closed history starts a new one. */
export async function openEmailConversation(env:Env,projectId:string,contactId:string){
 return env.DB.prepare('SELECT * FROM conversations WHERE project_id=? AND contact_id=? AND resolved_at IS NULL ORDER BY updated_at DESC,id LIMIT 1').bind(projectId,contactId).first<any>()
}

/** CC recipients the sender may add. Workspace addresses, members and contacts that
 * cannot take part are skipped; none of them refuses the message. */
export async function ccContacts(env:Env,projectId:string,conversation:any,addresses:string[],skipped:ReadonlySet<string>){
 const contacts:string[]=[]
 for(const address of addresses){
  if(skipped.has(address))continue
  if(await env.DB.prepare('SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND lower(u.email)=?').bind(projectId,address).first())continue
  const contact=await emailContact(env,projectId,address)
  if(contact&&contact.id!==conversation.contact_id)contacts.push(contact.id)
 }
 return contacts
}
