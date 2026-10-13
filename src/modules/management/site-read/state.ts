import type {Env} from '../../../platform/env'
import type {SqlGuard} from '../../../platform/integration-authority'
import {DEFAULT_WORKSPACE_COLOUR} from '../workspace-colour'

/** `site_read` in the project settings (BUILD.md I2). It is the only record of a read: its state is the once-only claim. */
export type SiteReadState = 'queued' | 'running' | 'done' | 'skipped' | 'failed' | 'uncertain'
export interface SiteReadRecord {state: SiteReadState; at: number; reason?: string; pages?: number; name?: string; colour?: string}

const RUNNING = "json_extract(settings_json,'$.site_read.state')='running'"
const LIVE = "json_type(settings_json,'$.deleted_at') IS NULL"

/** True when this call created the `queued` record. An existing record in any state, and demo workspaces, are left alone. */
export async function recordQueued(env: Env, projectId: string, now: number): Promise<boolean> {
 const queued = JSON.stringify({state: 'queued', at: now})
 const result = await env.DB.prepare(`INSERT INTO project_settings(project_id,settings_json,updated_at) SELECT ?,json_object('site_read',json(?)),? WHERE EXISTS(SELECT 1 FROM projects WHERE id=?)
  ON CONFLICT(project_id) DO UPDATE SET settings_json=json_set(settings_json,'$.site_read',json(?)),updated_at=excluded.updated_at
  WHERE json_type(project_settings.settings_json,'$.site_read') IS NULL AND json_extract(project_settings.settings_json,'$.is_demo') IS NOT 1 AND json_type(project_settings.settings_json,'$.deleted_at') IS NULL`)
  .bind(projectId, queued, now, projectId, queued).run()
 return result.meta.changes > 0
}

/** queued -> running, once. False means another delivery already took it, or the project is gone. */
export async function claimRead(env: Env, projectId: string, now: number): Promise<boolean> {
 const result = await env.DB.prepare(`UPDATE project_settings SET settings_json=json_set(settings_json,'$.site_read',json(?)),updated_at=? WHERE project_id=? AND json_extract(settings_json,'$.site_read.state')='queued' AND ${LIVE}`)
  .bind(JSON.stringify({state: 'running', at: now}), now, projectId).run()
 return result.meta.changes > 0
}

/** Everything the read writes is guarded by this: a read the scheduler already marked uncertain writes nothing more. */
export function runningGuard(projectId: string): SqlGuard {
 return {sql: `SELECT 1 FROM project_settings WHERE project_id=? AND ${RUNNING}`, params: [projectId]}
}

export async function finishRead(env: Env, projectId: string, record: SiteReadRecord): Promise<void> {
 await env.DB.prepare(`UPDATE project_settings SET settings_json=json_set(settings_json,'$.site_read',json(?)),updated_at=? WHERE project_id=? AND ${RUNNING}`)
  .bind(JSON.stringify(record), record.at, projectId).run()
}

/**
 * Replace the workspace name and colour with the site's, each by compare-and-set against the `derived` marker
 * (I2): the name only while it still equals the derived name, the colour only while it was a default and still is.
 * Anything the owner changed, before or after the read started, fails the comparison and stays.
 */
export async function applySiteIdentity(env: Env, projectId: string, found: {name: string | null; colour: string | null}, now: number): Promise<{name?: string; colour?: string}> {
 const statements: D1PreparedStatement[] = []
 if (found.name) {
  statements.push(env.DB.prepare(`UPDATE projects SET name=? WHERE id=? AND name<>? AND name=(SELECT json_extract(settings_json,'$.derived.name') FROM project_settings WHERE project_id=projects.id AND ${RUNNING} AND ${LIVE})`).bind(found.name, projectId, found.name))
 }
 if (found.colour) {
  statements.push(env.DB.prepare(`UPDATE project_settings SET settings_json=json_set(settings_json,'$.primary_color',?),updated_at=? WHERE project_id=? AND ${RUNNING} AND ${LIVE} AND json_extract(settings_json,'$.derived.colour')=1 AND lower(COALESCE(json_extract(settings_json,'$.primary_color'),?))=?`).bind(found.colour, now, projectId, DEFAULT_WORKSPACE_COLOUR, DEFAULT_WORKSPACE_COLOUR))
 }
 if (!statements.length) return {}
 const results = await env.DB.batch(statements)
 const applied: {name?: string; colour?: string} = {}
 let index = 0
 if (found.name && results[index++].meta.changes > 0) applied.name = found.name
 if (found.colour && results[index++].meta.changes > 0) applied.colour = found.colour
 return applied
}
