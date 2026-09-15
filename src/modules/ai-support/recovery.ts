import type {Env} from '../../platform/env'

/** A terminal generation is never executed again. Recover the attempt record
 * separately: reply completion requires the message committed by admission. */
export async function reconcileTerminalAttempt(env:Env,generationId:string){
 await env.DB.prepare(`UPDATE ai_attempts SET state=(
  SELECT CASE WHEN g.state='completed' AND (
   (g.kind='reply' AND EXISTS(SELECT 1 FROM messages m WHERE m.project_id=g.project_id AND m.conversation_id=g.conversation_id AND m.local_id='generation:'||g.id AND m.actor_role='ai' AND m.actor_id=g.ai_id AND m.revision=g.source_revision+1))
   OR (g.kind='suggestions' AND json_extract(g.output_json,'$.result') IS NOT NULL)
  ) THEN 'completed' ELSE 'uncertain' END FROM ai_generations g WHERE g.id=ai_attempts.generation_id
 ),finished_at=COALESCE(finished_at,?)
 WHERE generation_id=? AND state='running' AND EXISTS(SELECT 1 FROM ai_generations g WHERE g.id=ai_attempts.generation_id AND g.state NOT IN ('queued','running'))`).bind(new Date().toISOString(),generationId).run()
}
