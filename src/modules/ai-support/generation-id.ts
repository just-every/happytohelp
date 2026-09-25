import { HTTPException } from 'hono/http-exception'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A reply request's caller-chosen id becomes `ai_generations.id` and the AI reply's
 * `generation:<id>` local id, which contact erasure keeps so recovery can reconcile the
 * attempt. Only a UUID is accepted, so no visitor or operator text is stored as an id.
 */
export function clientGenerationId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !uuid.test(value)) throw new HTTPException(400, { message: 'requestId must be a UUID' })
  return value
}
