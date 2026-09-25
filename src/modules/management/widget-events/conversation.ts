import { HTTPException } from 'hono/http-exception'
import { requestGeneration } from '../../ai-support/repository'
import { clientGenerationId } from '../../ai-support/generation-id'
import { AiReplyCeilingReached } from '../../ai-support/reply-ceiling'
import type { WidgetCommand } from './types'

export async function markAsRead({ c, actor, conversation }: WidgetCommand) {
  await c.env.DB.prepare(
    'INSERT INTO conversation_reads VALUES(?,?,?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET revision=max(revision,excluded.revision)',
  ).bind(conversation.id, actor.id, conversation.revision).run()
  return c.json({ read: true })
}

export async function assignAi({ c, actor, conversation, data }: WidgetCommand) {
  const key = data.ai_id || data.aiId || data.id
  if (key && !await c.env.DB.prepare('SELECT id FROM ai_profiles WHERE id=? AND project_id=? AND is_enabled=1')
    .bind(key, actor.projectId).first()) throw new HTTPException(400)
  if (conversation.assigned_to) throw new HTTPException(409, { message: 'A human is handling this conversation' })
  await c.env.DB.prepare('INSERT INTO conversation_ai VALUES(?,?) ON CONFLICT(conversation_id) DO UPDATE SET ai_id=excluded.ai_id')
    .bind(conversation.id, key || null).run()
  return c.json({ assigned: true })
}

/** A visitor's explicit reply request: over a daily AI ceiling it answers 429 until 00:00 UTC. */
export async function requestReply({ c, actor, conversation, data }: WidgetCommand) {
  const generation = await requestGeneration(c.env, {
    projectId: actor.projectId,
    conversationId: conversation.id,
    actor,
    expectedRevision: conversation.revision,
    id: clientGenerationId(data.requestId),
  })
  if ('ceilingReached' in generation) throw new AiReplyCeilingReached()
  return c.json(generation, 202)
}
