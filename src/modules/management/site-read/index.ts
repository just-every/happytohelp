import type {Env} from '../../../platform/env'
import {recordQueued} from './state'

export {consumeSiteRead, recoverSiteReads} from './job'

/**
 * Queue the one-time read of the workspace's own website (BUILD.md I4). Returns `queued` when this call created the
 * job and `already` when a read exists in any state, so calling it again never repeats a read. A failure to hand the
 * job to the queue leaves the `queued` record in place, and the scheduler sends it again.
 */
export async function enqueueSiteRead(env: Env, projectId: string): Promise<'queued' | 'already'> {
 if (!await recordQueued(env, projectId, Date.now())) return 'already'
 try { await env.JOBS.send({type: 'site.read', id: projectId, projectId}) } catch (error) {
  console.error('Site read not yet queued', projectId, error instanceof Error ? error.message : String(error))
 }
 return 'queued'
}
