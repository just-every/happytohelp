import type {Env} from '../../../platform/env'
import {id} from '../../../platform/db'
import {starterModel} from './models'
import type {Condition} from './condition'

const prompt = `You answer visitors on behalf of this workspace's support team. Be warm, clear and brief.
Search the published help articles before you answer anything about products, prices, policies, accounts or how to do something, and base your answer on what they say. Cite the articles you used.
If the articles do not cover the question, say so plainly instead of guessing, and hand the conversation to a human teammate.
Hand over as well when the visitor asks for a person, or needs something you cannot do: you cannot look up orders or accounts, issue refunds, change bookings or settings, or promise dates. Never claim to have done any of these.
When you need a detail to answer, ask one focused question. Never ask for passwords, card numbers or other secrets.`

/** What the starter was created with. Stored as `starter_ai.seed` so the server can tell an untouched starter from one the owner edited. */
export function starterSeed(env: Env) {
 return {name: 'Support assistant', role: 'Support helper', prompt, model: starterModel(env), is_enabled: true}
}

/**
 * One enabled starter assistant, made the default for visitors and signed-in users (BUILD.md I2). Settings are
 * merged with json_insert, so a value already present in the row (an owner's, or another creation step's) is kept.
 */
export function starterAssistant(env: Env, projectId: string, now: number, when: Condition): D1PreparedStatement[] {
 const assistantId = id(), seed = starterSeed(env)
 const marker = JSON.stringify({id: assistantId, seed})
 return [
  env.DB.prepare(`INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,is_enabled,is_animated,avatar_url,created_at) SELECT ?,?,?,?,?,?,1,0,NULL,? WHERE ${when.sql}`)
   .bind(assistantId, projectId, seed.name, seed.role, seed.prompt, seed.model, now, ...when.params),
  env.DB.prepare(`INSERT INTO project_settings(project_id,settings_json,updated_at)
    SELECT ?,json_object('default_visitor_ai_id',?,'default_responder',?,'default_verified_user_ai_id',?,'starter_ai',json(?)),? WHERE ${when.sql}
    ON CONFLICT(project_id) DO UPDATE SET settings_json=json_insert(project_settings.settings_json,'$.default_visitor_ai_id',?,'$.default_responder',?,'$.default_verified_user_ai_id',?,'$.starter_ai',json(?)),updated_at=excluded.updated_at`)
   .bind(projectId, assistantId, assistantId, assistantId, marker, now, ...when.params, assistantId, assistantId, assistantId, marker),
 ]
}
