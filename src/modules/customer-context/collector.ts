import type {Env} from '../../platform/env'
// @ts-ignore Preserved widget telemetry distinction.
import * as idle from './collector/widgetIdleAction.js'
export const TRACKED_EVENT_TYPES=new Set(['PAGE_VIEW','AGENT_ASSIGNED','USED_INSIGHT'])
export function analysisInterval(count:number){return count<2?6:count<6?8:count<16?14:20}
export async function collectActions(env:Env,projectId:string,subjectId:string,input:unknown){
 if(!Array.isArray(input)||input.length>100||!input.length)throw new Error('Expected 1–100 collector actions')
 const subject=await env.DB.prepare('SELECT consent,bot_enabled FROM context_subjects WHERE project_id=? AND subject_id=?').bind(projectId,subjectId).first<any>()
 if(!subject?.consent||!subject.bot_enabled)return {accepted:0,reason:'consent_or_bot_disabled'}
 const rows=input.map((value:any)=>{if(typeof value?.localId!=='string'||!value.localId||value.localId.length>200||typeof value.action!=='string'||!value.action.trim()||value.action.length>10000)throw new Error('Invalid collector action');return value}).filter(value=>!idle.isSustainedWidgetIdleAction(value.action))
 if(!rows.length)return {accepted:0,reason:'idle_telemetry'}
 await env.DB.prepare('INSERT INTO context_collectors(project_id,subject_id) VALUES(?,?) ON CONFLICT DO NOTHING').bind(projectId,subjectId).run()
 const result=await env.DB.batch(rows.map(row=>env.DB.prepare(`INSERT INTO context_actions(id,project_id,subject_id,local_id,action,occurred_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM context_subjects WHERE project_id=? AND subject_id=? AND consent=1 AND bot_enabled=1) ON CONFLICT(project_id,subject_id,local_id) DO NOTHING`).bind(crypto.randomUUID(),projectId,subjectId,row.localId,row.action,Date.now(),projectId,subjectId)))
 return {accepted:result.reduce((n,r)=>n+(r.meta.changes||0),0),reason:'recorded'}
}
export async function trackEvents(env:Env,projectId:string,subjectId:string,events:any[]){
 if(!Array.isArray(events)||events.length>100)throw new Error('Invalid tracked event batch')
 const rows=events.filter(e=>TRACKED_EVENT_TYPES.has(e.type));for(const row of rows)if(typeof row.localId!=='string'||!row.localId||JSON.stringify(row.payload).length>10000)throw new Error('Invalid tracked event')
 if(rows.length)await env.DB.batch(rows.map(row=>env.DB.prepare(`INSERT INTO context_tracked_events(id,project_id,subject_id,local_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM context_subjects WHERE project_id=? AND subject_id=? AND consent=1) ON CONFLICT(project_id,subject_id,local_id) DO NOTHING`).bind(crypto.randomUUID(),projectId,subjectId,row.localId,row.type,JSON.stringify(row.payload),Date.now(),projectId,subjectId)))
 return (await env.DB.prepare('SELECT type,count(*) AS count FROM context_tracked_events WHERE project_id=? AND subject_id=? GROUP BY type').bind(projectId,subjectId).all()).results
}
