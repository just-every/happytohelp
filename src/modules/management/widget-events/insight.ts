import { HTTPException } from 'hono/http-exception'
import { text } from '../common'
import { admitInsightPair } from '../../conversations/insight-admission'
import { onCustomerMessage } from '../../ai-support/service'
import type { WidgetCommand } from './types'

interface InsightButton { id?: string; label: string; action?: string; text?: string }

export async function useInsight({ c, actor, conversation, data }: WidgetCommand) {
  const insightId = data.insight_id || data.insightId || data.id || ''
  const insight = await c.env.DB.prepare(
    'SELECT content,buttons FROM context_insights WHERE id=? AND project_id=? AND subject_id=? AND dismissed_at IS NULL',
  ).bind(insightId, actor.projectId, actor.contactId!).first<{ content: string; buttons: string }>()
  if (!insight) throw new HTTPException(404)
  if (data.close) {
    await c.env.DB.prepare('UPDATE context_insights SET dismissed_at=? WHERE id=? AND project_id=? AND subject_id=?')
      .bind(Date.now(), insightId, actor.projectId, actor.contactId!).run()
    return c.json({ dismissed: true })
  }

  const buttons = JSON.parse(insight.buttons) as InsightButton[]
  const choice = buttons.find(item =>
    (data.button_id && item.id === data.button_id) ||
    (data.label && item.label === data.label) ||
    (item.action === 'send' && item.text === (data.text || data.contact_message?.content)),
  )
  if (!choice) throw new HTTPException(400, { message: 'Select an existing insight response' })
  const result = await admitInsightPair(c.env, {
    actor,
    conversationId: conversation.id,
    insightId,
    button: choice.text || choice.label,
    aiLocalId: text(data.ai_message?.local_id, 200),
    contactLocalId: text(data.local_id || data.contact_message?.local_id || data.requestId, 200),
    expectedRevision: conversation.revision,
  })
  // Admission commits the pair and outbox before delivery; replays schedule no work.
  if (result.accepted && !result.duplicate) {
    const socket = c.env.CONVERSATIONS.get(c.env.CONVERSATIONS.idFromName(conversation.id))
    c.executionCtx.waitUntil(socket.fetch('https://conversation.internal/broadcast', {
      method: 'POST', body: JSON.stringify({ conversationId: conversation.id }),
    }))
    const last = result.messages?.at(-1)
    if (last) c.executionCtx.waitUntil(onCustomerMessage(c.env, last, actor))
  }
  return c.json(result, result.accepted ? 200 : 409)
}
