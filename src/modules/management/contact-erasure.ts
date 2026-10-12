import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv,Env} from '../../platform/env'
import {scope} from './common'
import {hashToken} from '../../platform/auth'
import {erasureEnvironment} from './contact-erasure/authority'
import {deleteStagedObjects,fenceAndStage} from './contact-erasure/objects'
import {erasureStatements} from './contact-erasure/statements'
import {contactEmails} from './contact-erasure/identity'

export interface ContactErasure {project_id: string; contact_id: string; erased_by: string; erased_at: number; last_erased_at: number; runs: number; conversations: number; messages: number; attachments: number; tracked_events: number; context_records: number; sessions: number}

/**
 * Permanently erase one contact's personal data inside its project. Steps are ordered
 * so an interrupted request is completed by repeating it: fence and stage objects,
 * delete R2 objects, then commit every D1 change and the audit row atomically.
 */
export async function eraseContact(env: Env, projectId: string, contactId: string, actorId: string, sessionHash?:string) {
  if(sessionHash)env=erasureEnvironment(env,projectId,actorId,sessionHash)
  const contact = await env.DB.prepare('SELECT email,external_id,metadata_json FROM contacts WHERE project_id=? AND id=?').bind(projectId, contactId).first<{email: string | null; external_id:string|null; metadata_json: string | null}>()
  if (!contact) return null
  const now = Date.now()
  const fenced=await fenceAndStage(env, projectId, contactId, now, contact)
  await deleteStagedObjects(env, projectId, contactId)
  await env.DB.batch(erasureStatements(env, {projectId, contactId, actorId, now, emails: [...new Set([...contactEmails(contact),...contactEmails(fenced??{})])]}))
  return env.DB.prepare('SELECT * FROM contact_erasures WHERE project_id=? AND contact_id=?').bind(projectId, contactId).first<ContactErasure>()
}

export const contactErasure = new Hono<AppEnv>()
contactErasure.post('/projects/:projectId/contacts/:contactId/erase', async c => {
  const actor = await scope(c, true)
  const token=c.req.header('Authorization')?.replace(/^Bearer /,'')||c.req.header('Cookie')?.match(/(?:^|;\s*)h2h_session=([^;]+)/)?.[1]
  const erasure = await eraseContact(c.env, actor.projectId, c.req.param('contactId'), actor.id,await hashToken(token!))
  if (!erasure) throw new HTTPException(404)
  return c.json({data: erasure})
})
