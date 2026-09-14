import type { Actor, Env } from './platform/env'
import { onCustomerMessage } from './modules/ai-support/service'
import { notifyMessage } from './modules/integrations/notifications'

// Admission persists its outbox in the same transaction as the message. HTTP
// handlers make effects prompt; the scheduler recovers a crash before this call.
export async function applyMessageEffects(env:Env,message:Record<string,unknown>,actor:Actor) {
 const results = await Promise.allSettled([onCustomerMessage(env,message,actor),notifyMessage(env,message,actor)])
 const failed = results.filter(result => result.status === 'rejected')
 if (failed.length) throw new Error('Message saved; a follow-up service failed. Check generation and email delivery status.')
}
