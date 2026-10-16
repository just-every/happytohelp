import type {Env} from '../../../platform/env'
import type {Condition} from './condition'

/**
 * The creating owner is alerted to new unassigned conversation activity, so a solo owner hears about a new
 * conversation. It stays a per-member preference that the owner can switch off. Runs after the owner's
 * membership insert in the creation batch.
 */
export function ownerAlerts(env: Env, projectId: string, when: Condition): D1PreparedStatement[] {
 return [
  env.DB.prepare(`INSERT INTO user_project_preferences(project_id,user_id,is_notified_on_unassigned_activity)
    SELECT m.project_id,m.user_id,1 FROM memberships m WHERE m.project_id=? AND m.role='owner' AND ${when.sql}
    ON CONFLICT(project_id,user_id) DO UPDATE SET is_notified_on_unassigned_activity=1`)
   .bind(projectId, ...when.params),
 ]
}
