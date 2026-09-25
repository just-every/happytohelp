import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv,Env} from '../../platform/env'
import {scope} from './common'
import {deleteStagedObjects,fenceAndStage} from './contact-erasure/objects'
import {erasureStatements} from './contact-erasure/statements'

export interface ContactErasure {project_id: string; contact_id: string; erased_by: string; erased_at: number; last_erased_at: number; runs: number; conversations: number; messages: number; attachments: number; tracked_events: number; context_records: number; sessions: number}

function contactEmails(row: {email: string | null; metadata_json: string | null}) {
  let metadata: Record<string, unknown> = {}
  try { metadata = JSON.parse(row.metadata_json || '{}') } catch { metadata = {} }
  return [...new Set([row.email, metadata.provided_email].filter((value): value is string => typeof value === 'string' && value.trim() !== '').map(value => value.trim().toLowerCase()))]
}

/**
 * Permanently erase one contact's personal data inside its project. Steps are ordered
 * so an interrupted request is completed by repeating it: fence and stage objects,
 * delete R2 objects, then commit every D1 change and the audit row atomically.
 */
export async function eraseContact(env: Env, projectId: string, contactId: string, actorId: string) {
  const contact = await env.DB.prepare('SELECT email,metadata_json FROM contacts WHERE project_id=? AND id=?').bind(projectId, contactId).first<{email: string | null; metadata_json: string | null}>()
  if (!contact) return null
  const now = Date.now()
  await fenceAndStage(env, projectId, contactId, now)
  await deleteStagedObjects(env, projectId, contactId)
  await env.DB.batch(erasureStatements(env, {projectId, contactId, actorId, now, emails: contactEmails(contact)}))
  return env.DB.prepare('SELECT * FROM contact_erasures WHERE project_id=? AND contact_id=?').bind(projectId, contactId).first<ContactErasure>()
}

export const contactErasure = new Hono<AppEnv>()
contactErasure.post('/projects/:projectId/contacts/:contactId/erase', async c => {
  const actor = await scope(c, true)
  const erasure = await eraseContact(c.env, actor.projectId, c.req.param('contactId'), actor.id)
  if (!erasure) throw new HTTPException(404)
  return c.json({data: erasure})
})
