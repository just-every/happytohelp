/** The retained ensemble cost field may be calculated from token prices. */
export function persistedCost(usageJson: string | null) {
 let usage: any
 try { usage = JSON.parse(usageJson || 'null') } catch { return { actual: null, unverified: null } }
 const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
 // The existing xAI adapter preserves its raw USD ticks in metadata. The LLM
 // adapters preserve tokens, but do not preserve an actual provider USD receipt.
 // Do not infer provenance from a numeric cost, model name or observed flag.
 const ticks = usage?.metadata?.provider_cost_ticks
 const actual = usage?.metadata?.source === 'xai' && Number.isSafeInteger(ticks) && ticks >= 0
  && usage?.metadata?.estimated_cost !== true ? ticks / 10_000_000_000 : null
 return { actual, unverified: actual === null && valid(usage?.cost) ? usage.cost : null }
}
