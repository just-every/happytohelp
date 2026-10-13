import type {Env} from '../../../platform/env'
import type {SqlGuard} from '../../../platform/integration-authority'
import {enqueueSiteRead} from '../site-read/index'
import {creationCondition} from './condition'
import {inboundMailbox, proposedSender} from './inbound-mailbox'
import {starterAssistant} from './starter-assistant'

export {starterModels, defaultStarterProvider, installedProvider, providerKeyInstalled, starterModel, modelReady, modelReadiness} from './models'
export type {ModelProvider} from './models'
export {starterSeed} from './starter-assistant'

export type WorkspaceSeed = {projectId: string; name: string; website: string; ownerEmail: string}

/**
 * What every new workspace starts with (BUILD.md I1): the starter assistant as its default responder, the `starter_ai`
 * marker, the `proposed_sender` its mail moves to once its domain is verified and, when the installation holds
 * `INBOUND_EMAIL_TOKEN`, its reply-by-email mailbox, sending from the installation sender until then.
 *
 * `statements` join the creation batch after the project insert and after any project settings insert, so they commit
 * with the workspace or not at all; `guard` (the caller's creation guard, `EXISTS(guard.sql)`) is asserted on each.
 * `after` runs once the batch has committed: it queues the one-time read of the website and never throws.
 * Demo workspaces are not created through here and are never provisioned.
 */
export function workspaceDefaults(env: Env, seed: WorkspaceSeed, guard?: SqlGuard): {statements: D1PreparedStatement[]; after: () => Promise<void>} {
 const now = Date.now(), when = creationCondition(seed.projectId, guard)
 return {
  statements: [...starterAssistant(env, seed.projectId, now, when), ...proposedSender(env, seed, now, when), ...inboundMailbox(env, seed, now, when)],
  after: async () => {
   try { await enqueueSiteRead(env, seed.projectId) } catch (error) {
    console.error('Site read not queued', seed.projectId, error instanceof Error ? error.message : String(error))
   }
  },
 }
}
