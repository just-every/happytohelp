import {policyRoles} from './state'

/** What a primary sign-in still needs: the account's second factor, enrolment the workspace requires, or nothing. */
export async function signInFactor(db:D1Database,userId:string,projectId:string|null,role:string):Promise<'verify'|'enrol'|null>{
 const row=await db.prepare(`SELECT EXISTS(SELECT 1 FROM user_factors WHERE user_id=?1 AND confirmed_at IS NOT NULL) has_factor,
  (SELECT json_extract(settings_json,'$.two_factor_roles') FROM project_settings WHERE project_id=?2) roles,
  (SELECT CASE WHEN mr.role_key='collaborator' OR pr.base='collaborator' THEN 'collaborator' END FROM member_roles mr LEFT JOIN project_roles pr ON pr.id=mr.role_key AND pr.project_id=mr.project_id WHERE mr.project_id=?2 AND mr.user_id=?1) policy_role`).bind(userId,projectId).first<{has_factor:number;roles:string|null;policy_role:string|null}>()
 if(row?.has_factor)return 'verify'
 return projectId&&policyRoles(row?.roles).includes(row?.policy_role||role)?'enrol':null
}
