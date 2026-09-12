import type { Bindings, Job } from './types';
import { jobView } from './types';
export type RequestRow={id:string;workspace_id:string;subject:string;customer_email:string;body:string;status:string;created_at:string;updated_at:string};
export const requestView=(r:RequestRow)=>({id:r.id,workspaceId:r.workspace_id,subject:r.subject,customerEmail:r.customer_email,body:r.body,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at});
export async function jobEvents(env:Bindings, jobId:string) {
  const rows=await env.DB.prepare('SELECT id,run_id,kind,payload_json,created_at FROM events WHERE job_id=? ORDER BY created_at,id').bind(jobId).all<{id:string;run_id:string|null;kind:string;payload_json:string;created_at:string}>();
  return rows.results.map(r=>({id:r.id,runId:r.run_id,kind:r.kind,message:JSON.parse(r.payload_json).message ?? JSON.parse(r.payload_json).summary ?? JSON.parse(r.payload_json).question ?? r.kind,payload:JSON.parse(r.payload_json),createdAt:r.created_at}));
}
export async function context(env:Bindings,job:Job) {
  const row=await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(job.request_id).first<RequestRow>();
  const workspace=await env.DB.prepare('SELECT id,name,path FROM workspaces WHERE id=?').bind(job.workspace_id).first();
  return {job:jobView(job),request:row?requestView(row):null,workspace,events:await jobEvents(env,job.id)};
}
