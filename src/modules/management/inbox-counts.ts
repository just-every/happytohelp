import type {Env} from '../../platform/env'
import {hasMessages} from './inbox-visible'
/** A single aggregate keeps inbox counts bounded as imported history grows. Moved-in messages are
 * history, never unread. */
export async function inboxCounts(env:Env,userId:string,project?:string){return env.DB.prepare(`SELECT
 COALESCE(SUM(COALESCE(c.resolved_at,0)=0 AND c.assigned_to=?1 AND NOT EXISTS(SELECT 1 FROM conversation_ai ca WHERE ca.conversation_id=c.id AND ca.ai_id IS NOT NULL)),0) mine,
 COALESCE(SUM(COALESCE(c.resolved_at,0)=0 AND NOT EXISTS(SELECT 1 FROM conversation_ai ca WHERE ca.conversation_id=c.id AND ca.ai_id IS NOT NULL)),0) open,
 COALESCE(SUM(COALESCE(c.resolved_at,0)=0 AND COALESCE(c.assigned_to,'')='' AND NOT EXISTS(SELECT 1 FROM conversation_ai ca WHERE ca.conversation_id=c.id AND ca.ai_id IS NOT NULL)),0) unassigned,
 COALESCE(SUM(EXISTS(SELECT 1 FROM conversation_ai ca JOIN ai_profiles a ON a.id=ca.ai_id WHERE ca.conversation_id=c.id)),0) ai,
 COALESCE(SUM(COALESCE(c.resolved_at,0)<>0 AND NOT EXISTS(SELECT 1 FROM conversation_ai ca WHERE ca.conversation_id=c.id AND ca.ai_id IS NOT NULL)),0) closed,
 COALESCE(SUM(COALESCE(c.resolved_at,0)=0 AND EXISTS(SELECT 1 FROM messages msg WHERE msg.conversation_id=c.id AND msg.actor_role='contact' AND NOT EXISTS(SELECT 1 FROM move_in_message_sources ims WHERE ims.message_id=msg.id) AND msg.revision>COALESCE((SELECT revision FROM conversation_reads cr WHERE cr.conversation_id=c.id AND cr.user_id=?1),0))),0) unread
 FROM conversations c WHERE EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=c.project_id AND m.user_id=?1) AND ${hasMessages} ${project?'AND c.project_id=?2':''}`).bind(userId,...(project?[project]:[])).first()}
