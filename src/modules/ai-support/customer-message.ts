import type { Env, Actor } from '../../platform/env';
import { requestGeneration, type AssignmentReplyGuard } from './repository';
import {isAutomaticInboundEmail} from '../integrations/inbound-origin';
export async function onCustomerMessage(env: Env, message: any, actor: Actor) {
    if (actor.role !== 'contact')
        return;
    const selected = await env.DB.prepare('SELECT a.id,a.model FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id JOIN conversations c ON c.id=ca.conversation_id WHERE c.id=? AND c.project_id=? AND a.project_id=c.project_id AND a.is_enabled=1 AND c.assigned_to IS NULL AND c.resolved_at IS NULL AND c.last_message_id=? AND c.revision=?').bind(message.conversation_id, actor.projectId, message.id, message.revision).first();
    if (!selected)
        return;
    await requestGeneration(env, { projectId: actor.projectId, conversationId: message.conversation_id, actor, expectedRevision: message.revision, id: `reply:${message.id}` }, 'record');
}

/** A handoff answers only the still-waiting visitor turn. Reuse the message's
 * automatic command identity so retries, ceiling skips and uncertain attempts
 * cannot become another provider request, even across assistant changes. */
export async function onAssistantAssignment(env:Env,projectId:string,conversationId:string,guard:AssignmentReplyGuard){
    const message=await env.DB.prepare(`SELECT m.* FROM conversations c JOIN messages m ON m.id=c.last_message_id AND m.conversation_id=c.id AND m.project_id=c.project_id
        WHERE c.id=? AND c.project_id=? AND c.assigned_to IS NULL AND c.resolved_at IS NULL AND m.actor_role='contact' AND m.actor_id=c.contact_id AND (${guard.sql})`).bind(conversationId,projectId,...guard.params).first<any>();
    if(!message||await isAutomaticInboundEmail(env,projectId,message))return;
    const id=`reply:${message.id}`;
    // Any prior disposition is authoritative, including cancelled/uncertain work.
    if(await env.DB.prepare("SELECT id FROM ai_generations WHERE project_id=? AND conversation_id=? AND source_revision=? AND kind='reply'").bind(projectId,conversationId,message.revision).first())return;
    const actor:Actor={id:message.actor_id,contactId:message.actor_id,projectId,role:'contact'};
    await requestGeneration(env,{projectId,conversationId,actor,expectedRevision:message.revision,id},'record',guard);
}
