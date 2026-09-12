export interface Bindings {
  DB: D1Database;
  H2H_BOOTSTRAP_TOKEN?: string;
  APP_ORIGIN?: string;
  SENDGRID_API_KEY?: string;
  MAIL_FROM?: string;
}
export interface Operator { id: string; email: string; name: string }
export interface Agent { id: string; name: string; revoked_at: string | null }
export type Env = { Bindings: Bindings; Variables: { operator: Operator; agent: Agent } };
export type Job = {
  id: string; request_id: string; workspace_id: string; assigned_agent_id: string | null;
  mode: 'investigate' | 'resolve' | 'resolve_reply'; instructions: string; status: string;
  agent_id: string | null; session_id: string | null; run_id: string | null;
  lease_expires_at: string | null; result_json: string | null; created_at: string; updated_at: string;
};
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const lease = () => new Date(Date.now() + 120_000).toISOString();
export function jobView(j: Job) {
  return { id: j.id, requestId: j.request_id, workspaceId: j.workspace_id, assignedAgentId: j.assigned_agent_id,
    mode: j.mode, instructions: j.instructions, status: j.status, agentId: j.agent_id, sessionId: j.session_id,
    runId: j.run_id, leaseExpiresAt: j.lease_expires_at, result: j.result_json ? JSON.parse(j.result_json) : null,
    createdAt: j.created_at, updatedAt: j.updated_at };
}
