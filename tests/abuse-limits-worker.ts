import { app } from '../src/app'
import { saveEvent } from '../src/modules/ai-support/repository'
import { applyMessageEffects } from '../src/message-effects'
import type { Env } from '../src/platform/env'
import { enforceRateLimits, RateLimitExceeded } from '../src/platform/rate-limits'
import type { RateLimitName } from '../src/platform/limit-config'
export { ConversationSocket } from '../src/modules/conversations/socket'

// Test-only probes around the real application: a provider cost report through the
// usage accounting path, the scheduler's outbox replay of message effects, and the
// request limiter at an injected clock reading (window boundaries without waiting).
export default {
 async fetch(request: Request, env: Env, context: ExecutionContext) {
  const url = new URL(request.url)
  if (url.pathname === '/__probe/cost') {
   const { attemptId, requestId, cost } = await request.json() as { attemptId: string; requestId: string; cost: number }
   await saveEvent(env, attemptId, { type: 'cost_update', request_id: requestId, usage: { model: 'fixture-model', cost } })
   return Response.json({ recorded: true })
  }
  if (url.pathname === '/__probe/replay-effects') {
   const { messageId } = await request.json() as { messageId: string }
   const message = await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(messageId).first<Record<string, unknown>>()
   if (!message) return Response.json({ error: 'missing message' }, { status: 404 })
   await applyMessageEffects(env, message, { id: String(message.actor_id), projectId: String(message.project_id), role: 'contact', contactId: String(message.actor_id) })
   return Response.json({ replayed: true })
  }
  if (url.pathname === '/__probe/rate-limit') {
   const { checks, now } = await request.json() as { checks: Array<[RateLimitName, string, number?]>; now: number }
   try { await enforceRateLimits(env, checks, now); return Response.json({ allowed: true }) }
   catch (error) { if (error instanceof RateLimitExceeded) return Response.json({ allowed: false, limit: error.limit, retryAfter: error.retryAfter }); throw error }
  }
  return app.fetch(request, env, context)
 },
}
