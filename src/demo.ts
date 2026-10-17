// `rer demo` and the hosted demo: a lived-in Fernwood Home help desk, written once
// after the owner exists (Base modules/demo calls seedDemo). Idempotent: fixed ids
// and INSERT OR IGNORE throughout. Nothing here fetches.
import type { Env } from './platform/env'
import { seedWorkspaces } from './demo/workspaces'
import { conversationStatements } from './demo/conversations'

const BATCH = 250

/** The active owner of this installation, or null before the owner claim. */
export async function demoOwner(env: Env): Promise<string | null> {
  const row = await env.DB.prepare("SELECT u.email FROM users u JOIN memberships m ON m.user_id=u.id AND m.role='owner' ORDER BY u.created_at LIMIT 1").first<{ email: string }>()
  return row?.email ?? null
}

export async function seedDemo(env: Env, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
  const owner = await env.DB.prepare("SELECT u.id,m.project_id projectId FROM users u JOIN memberships m ON m.user_id=u.id AND m.role='owner' WHERE lower(u.email)=lower(?) ORDER BY u.created_at,m.project_id LIMIT 1")
    .bind(ownerEmail).first<{ id: string; projectId: string }>()
  if (!owner) throw new Error('The demo owner has no workspace')
  const at = now.getTime()
  const { people, projects, fernId } = await seedWorkspaces(env, owner, at)
  const statements = conversationStatements(env, people, projects, fernId, at)
  for (let index = 0; index < statements.length; index += BATCH) await env.DB.batch(statements.slice(index, index + BATCH))
}
