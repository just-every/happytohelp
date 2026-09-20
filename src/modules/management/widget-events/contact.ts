import { HTTPException } from 'hono/http-exception'
import { text } from '../common'
import type { WidgetCommand } from './types'

export async function updateContact({ c, actor, data }: WidgetCommand) {
  const contact = await c.env.DB.prepare(
    'SELECT name,email FROM contacts WHERE id=? AND project_id=?',
  ).bind(actor.contactId!, actor.projectId).first<{ name: string | null; email: string | null }>()
  const name = data.provided_name ?? data.name ?? contact!.name
  const email = data.provided_email ?? data.email ?? contact!.email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HTTPException(400)
  await c.env.DB.prepare('UPDATE contacts SET name=?,email=? WHERE id=? AND project_id=?')
    .bind(name ? text(name, 200) : null, email ? text(email, 320) : null, actor.contactId!, actor.projectId).run()
  return c.json({ updated: true, contact: { id: actor.contactId, name, email } })
}

export async function recordPresence({ c, actor, data, action }: WidgetCommand) {
  const row = await c.env.DB.prepare('SELECT metadata_json FROM contacts WHERE id=? AND project_id=?')
    .bind(actor.contactId!, actor.projectId).first<{ metadata_json: string }>()
  const metadata = JSON.parse(row?.metadata_json || '{}') as Record<string, unknown>
  metadata.last_seen_at = Date.now()
  if (action === 'instruction') metadata.widget_opened = Boolean(data.opened ?? data.value ?? true)
  await c.env.DB.prepare('UPDATE contacts SET metadata_json=? WHERE id=? AND project_id=?')
    .bind(JSON.stringify(metadata), actor.contactId!, actor.projectId).run()
  return c.json({ recorded: true })
}
