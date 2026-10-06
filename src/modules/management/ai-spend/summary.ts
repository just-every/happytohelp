import { persistedCost } from './cost.ts'

/** Read-only summaries of persisted receipts. Never estimate a provider charge. */
export type SpendRow = {
 generation_id: string; generation_state: string; attempt_id: string | null;
 request_id: string | null; observed: number | null; usage_json: string | null;
}
export function summarizeSpend(rows: SpendRow[]) {
 const generations = new Map<string, SpendRow>(), rounds = new Map<string, SpendRow>()
 for (const row of rows) {
  generations.set(row.generation_id, row)
  if (row.request_id !== null) rounds.set(JSON.stringify([row.attempt_id, row.request_id]), row)
 }
 let knownUsd = 0, knownRounds = 0, unknownRounds = 0, unverifiedUsd = 0, unverifiedRounds = 0
 for (const row of rounds.values()) {
  const receipt = persistedCost(row.usage_json), cost = receipt.actual
  if (row.observed === 1 && receipt.unverified !== null && Number.isFinite(unverifiedUsd + receipt.unverified)) {
   unverifiedUsd += receipt.unverified; unverifiedRounds++
  }
  if (row.observed === 1 && typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 && Number.isFinite(knownUsd + cost)) {
   knownUsd += cost; knownRounds++
  } else unknownRounds++
 }
 const withRounds = new Set([...rounds.values()].map(row => row.generation_id))
 const unmeasuredGenerations = [...generations.values()].filter(row => !withRounds.has(row.generation_id)
  && (row.attempt_id !== null || ['running', 'completed', 'uncertain'].includes(row.generation_state))).length
 const pendingGenerations = [...generations.values()].filter(row => row.generation_state === 'queued').length
 const inProgressGenerations = [...generations.values()].filter(row => ['running', 'uncertain'].includes(row.generation_state)).length
 const incomplete = unknownRounds > 0 || unmeasuredGenerations > 0 || inProgressGenerations > 0
 const state = incomplete ? (knownRounds ? 'partial' : 'unknown') : knownRounds ? 'known' : 'empty'
 return { state, unverifiedUsd: unverifiedRounds ? unverifiedUsd : null, unverifiedRounds, knownUsd: knownRounds ? knownUsd : null, knownRounds, unknownRounds,
  unmeasuredGenerations, pendingGenerations, inProgressGenerations, generations: generations.size, rounds: rounds.size }
}
