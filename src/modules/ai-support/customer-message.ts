import type { Env, Actor } from '../../platform/env';
import { requestGeneration } from './repository';
export async function onCustomerMessage(env: Env, message: any, actor: Actor) {
    if (actor.role !== 'contact')
        return;
    const selected = await env.DB.prepare('SELECT a.id,a.model FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id JOIN conversations c ON c.id=ca.conversation_id WHERE c.id=? AND c.project_id=? AND a.project_id=c.project_id AND a.is_enabled=1 AND c.assigned_to IS NULL AND c.resolved_at IS NULL AND c.last_message_id=? AND c.revision=?').bind(message.conversation_id, actor.projectId, message.id, message.revision).first();
    if (!selected)
        return;
    await requestGeneration(env, { projectId: actor.projectId, conversationId: message.conversation_id, actor, expectedRevision: message.revision, id: `reply:${message.id}` }, 'record');
}
