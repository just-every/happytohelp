import { HTTPException } from 'hono/http-exception'
import { handleContextWidgetAction } from '../../customer-context/index'
import type { WidgetCommand } from './types'

export async function dispatchContextAction(
  { c, actor, conversation, action }: Omit<WidgetCommand, 'data'>,
  data: unknown,
) {
  const result = await handleContextWidgetAction(c.env, actor, conversation.id, action, data)
  if (result !== null) return c.json(result)
  throw new HTTPException(400, { message: 'Unknown widget action' })
}
