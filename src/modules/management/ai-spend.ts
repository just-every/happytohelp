import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { scope } from './common'
import { automaticAiUsage } from '../ai-support/reply-ceiling'
import { contextRunUsage } from '../customer-context/run-ceiling'
import { aiCeilingDefaults } from '../../platform/limit-config'
import { summarizeSpend, type SpendRow } from './ai-spend/summary'

export const aiSpend = new Hono<AppEnv>()
aiSpend.get('/projects/:projectId/ai-spend', async c => {
 const actor = await scope(c)
 if (c.get('actor').projectId !== actor.projectId) throw new HTTPException(403, { message: 'Switch to this project to view its AI spend' })
 // A day is assigned by attempt start (or generation creation if not started).
 // Round receipts have no timestamps; never imply this is a provider invoice day.
 const automatic = await automaticAiUsage(c.env, actor.projectId)
 const start = `${automatic.day}T00:00:00.000Z`, end = automatic.resetsAt
 const [rows, contextRuns] = await Promise.all([
  c.env.DB.prepare(`SELECT g.id generation_id,g.state generation_state,a.id attempt_id,
   u.request_id,u.observed,u.usage_json FROM ai_generations g
   LEFT JOIN ai_attempts a ON a.generation_id=g.id
   LEFT JOIN ai_round_usage u ON u.attempt_id=a.id
   WHERE g.project_id=? AND coalesce(a.started_at,g.created_at)>=? AND coalesce(a.started_at,g.created_at)<?`)
   .bind(actor.projectId, start, end).all<SpendRow>(),
  contextRunUsage(c.env, actor.projectId),
 ])
 const raw = c.env.AI_DAILY_CEILINGS?.trim()
 // automaticAiUsage already validates the override object, including unknown keys.
 const configured = raw ? JSON.parse(raw) : {}
 const defaults = Object.keys(aiCeilingDefaults).filter(key => !(key in configured))
 c.header('Cache-Control', 'private, no-store')
 return c.json({ data: {
  projectId: actor.projectId, day: automatic.day, resetsAt: end,
  scope: 'conversation_generations', dayBasis: 'generation_attempt_started',
  spend: summarizeSpend(rows.results),
  automatic: { ...automatic, spendUsd: { ...automatic.spendUsd, basis: 'persisted_cost_counter_may_include_estimates' } },
  contextRuns: { ...contextRuns, ceilingReached: contextRuns.used >= contextRuns.limit },
  ceilingDefaults: defaults,
  excluded: ['customer_context', 'training', 'brand_generation', 'local_agent', 'provider_account_activity'],
 } })
})
