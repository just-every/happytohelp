import type {SqlGuard} from '../../../platform/integration-authority'

/** A WHERE condition with its bound values. */
export type Condition = {sql: string; params: (string | number | null)[]}

/**
 * Provisioning writes only once the workspace row exists in the same batch, and only while the caller's creation
 * guard holds. A creation that inserts nothing therefore provisions nothing.
 */
export function creationCondition(projectId: string, guard?: SqlGuard): Condition {
 const exists = 'EXISTS(SELECT 1 FROM projects WHERE id=?)'
 return guard ? {sql: `${exists} AND EXISTS(${guard.sql})`, params: [projectId, ...guard.params]} : {sql: exists, params: [projectId]}
}
