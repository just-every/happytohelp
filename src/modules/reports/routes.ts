import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {scope} from '../management/common'
import {reportRange,validTimezone} from './calendar'
import {readReport} from './read'
import {exportCSV,summaryCSV} from './csv'
import {requireStepUp} from '../identity/two-factor/step-up'
import {auditStatement,requestSource} from '../audit/record'
export const reports=new Hono<AppEnv>()
reports.get('/projects/:projectId/reports',async c=>{
 const actor=await scope(c),settings=await c.env.DB.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(actor.projectId).first<{settings_json:string}>(),timezone=JSON.parse(settings?.settings_json||'{}').timezone||'UTC'
 if(!validTimezone(timezone))throw new HTTPException(422,{message:'Choose a valid workspace timezone in Project settings before opening Reports'})
 const query=c.req.query(),range=reportRange(query,timezone)
 if(query.format){if(!['conversations.csv','summary.csv'].includes(query.format))throw new HTTPException(400);await requireStepUp(c,actor,'reports.export');await auditStatement(c.env.DB,{projectId:actor.projectId,category:'data',action:'reports.exported',actor:{type:'user',id:actor.id},source:requestSource(c),detail:{format:query.format,start:range.start,end:range.end}}).run();return new Response(query.format==='summary.csv'?summaryCSV(await readReport(c.env,actor.projectId,range)):exportCSV(c.env,actor.projectId,range),{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${query.format}"`,'Cache-Control':'no-store'}})}
 return c.json(await readReport(c.env,actor.projectId,range))
})
