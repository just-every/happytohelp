import {apiContactIdentityGuard} from './contact-identity'
import {contactWritable} from '../../platform/contact-state'
import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import type {SqlGuard} from '../../platform/integration-authority'
import {newContactInput} from './contact-input'
export async function createContactResource(env:Env,projectId:string,body:Record<string,unknown>,guard?:SqlGuard,id=crypto.randomUUID()){
 const contact=newContactInput(body),now=Date.now()
 if(guard)guard=apiContactIdentityGuard(projectId,{email:contact.email,external_id:contact.externalId},guard)
 const result=await env.DB.prepare(`INSERT INTO contacts(id,project_id,name,email,external_id,created_at) SELECT ?,?,?,?,?,? ${guard?`WHERE EXISTS(${guard.sql})`:''}`).bind(id,projectId,contact.name,contact.email,contact.externalId,now,...(guard?.params||[])).run()
 if(!result.meta.changes)throw new HTTPException(409,{message:'Authority changed'})
 const current=await env.DB.prepare(`SELECT * FROM contacts WHERE id=? AND project_id=? AND ${contactWritable}`).bind(id,projectId).first()
 if(!current)throw new HTTPException(409,{message:'Contact changed; reload before editing'})
 return current
}
