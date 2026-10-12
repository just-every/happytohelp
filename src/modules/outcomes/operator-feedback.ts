import type {Env} from '../../platform/env'

/** Operator-only history. Visitor eligibility continues to use resolutionState. */
export async function pastResolutionFeedback(env:Env,projectId:string,conversationId:string,userId:string){
 const rows=await env.DB.prepare(`SELECT r.id,r.ordinal,r.resolved_at,r.reopened_at,r.outcome,json_extract(r.evidence_json,'$.historicalResolutionOrderUnknown') order_unknown,v.value,v.comment,v.updated_at,v.revision
 FROM conversation_resolutions r JOIN conversations c ON c.id=r.conversation_id AND c.project_id=r.project_id
 JOIN projects p ON p.id=c.project_id
 LEFT JOIN conversation_ratings v ON v.resolution_id=r.id
 WHERE c.id=? AND c.project_id=? AND r.reopened_at IS NOT NULL
 AND EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=c.project_id AND m.user_id=?)
 AND NOT EXISTS(SELECT 1 FROM project_settings ps WHERE ps.project_id=c.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)
 ORDER BY r.ordinal DESC`).bind(conversationId,projectId,userId).all<any>()
 return rows.results.map(row=>({id:row.id,ordinal:row.ordinal,orderUnknown:row.order_unknown===1,resolvedAt:new Date(row.resolved_at).toISOString(),reopenedAt:new Date(row.reopened_at).toISOString(),outcome:row.outcome,rating:row.value===null?null:{value:row.value,comment:row.comment,updatedAt:new Date(row.updated_at).toISOString(),revision:row.revision}}))
}
