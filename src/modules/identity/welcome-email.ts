import type {Env} from '../../platform/env'
import {emailConfigured, sendEmail} from '../integrations/email'
import {linkOrigin} from './magic-link'

/** What happened to the one welcome email: `not_configured` means nothing was attempted. */
export type WelcomeOutcome = 'suppressed' | 'sent' | 'not_configured' | 'failed' | 'uncertain'

/**
 * Pressing Create workspace is the owner's explicit action that sends one welcome email to the owner. It goes through the
 * durable idempotent send path under a key fixed by the workspace, so nothing repeats it, and a send whose outcome is unknown
 * stays unknown: the delivery record is read, never retried. It leaves from the workspace's sender, which provisioning seeds
 * with the installation's own `EMAIL_FROM`. Never throws; setup has already succeeded, whatever the outcome.
 */
export async function sendWelcomeEmail(env: Env, welcome: {projectId: string; workspaceName: string; ownerEmail: string}): Promise<WelcomeOutcome> {
 if (!emailConfigured(env)) return 'not_configured'
 const origin = linkOrigin(env), idempotencyKey = `welcome:${welcome.projectId}`
 const open = origin ? `Open it here: ${new URL(`/projects/${encodeURIComponent(welcome.projectId)}/activation`, origin).href}` : 'Sign in to open it.'
 try {
  const receipt=await sendEmail(env, {
   to: welcome.ownerEmail, projectId: welcome.projectId, idempotencyKey,
   subject: 'Welcome to HappyToHelp',
   text: `Your HappyToHelp workspace "${welcome.workspaceName}" is ready. ${open}\n\nThis is the one message sent when a workspace is created. You are receiving it because this address was used to create the workspace.`,
   headers: {'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All'},
  })
  return receipt.state==='suppressed'?'suppressed':'sent'
 } catch (error) {
  console.error('Welcome email not sent', welcome.projectId, error instanceof Error ? error.message : String(error))
  const row = await env.DB.prepare('SELECT state FROM email_deliveries WHERE id=?').bind(idempotencyKey).first<{state: string}>().catch(() => null)
  return row?.state === 'sent' ? 'sent' : row?.state === 'failed' || !row ? 'failed' : 'uncertain'
 }
}
