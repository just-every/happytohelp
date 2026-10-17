import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {Actor,AppEnv,Env} from '../../platform/env'
import {scope} from '../management/common'
import {viewAuthority,viewAudit} from './views-authority'
import {compileFilters,parseFilters,type TicketFilter} from './filters'
import {compileSort,parseSort,type TicketSort} from './sort'
import {bulkRoutes} from './bulk'

interface ViewRow {id:string;project_id:string;owner_id:string;name:string;visibility:'personal'|'shared';filters_json:string;sort_json:string;version:number;created_at:number;updated_at:number}
export const viewData=(row:ViewRow)=>{const {filters_json,sort_json,...view}=row;return {...view,filters:JSON.parse(filters_json),sort:JSON.parse(sort_json)}}
async function visibleDefinition(env:Env,actor:Actor,row:ViewRow){
 const data=viewData(row)
 try{await compileFilters(env,actor,row.project_id,parseFilters(data.filters));await compileSort(env,actor,row.project_id,parseSort(data.sort));return {...data,unavailable:false}}
 catch(error){
  if(!(error instanceof HTTPException)||![400,403].includes(error.status))throw error
  const {filters,sort,...metadata}=data
  return {...metadata,unavailable:true}
 }
}
export async function readableView(env:Env,actor:Actor,project:string,id:string){
 const row=await env.DB.prepare("SELECT * FROM ticket_views WHERE project_id=? AND id=? AND (visibility='shared' OR owner_id=?)").bind(project,id,actor.id).first<ViewRow>()
 if(!row)throw new HTTPException(404,{message:'Saved view not found'})
 return row
}
async function definition(env:Env,actor:Actor,body:any){
 if(!body||typeof body!=='object'||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>100||!['personal','shared'].includes(body.visibility))throw new HTTPException(400,{message:'A view needs a name of 1–100 characters and personal or shared visibility'})
 const filters=parseFilters(body.filters??[]),sort=parseSort(body.sort??[])
 await compileFilters(env,actor,actor.projectId,filters);await compileSort(env,actor,actor.projectId,sort)
 return {name:body.name.trim(),visibility:body.visibility as 'personal'|'shared',filters,sort}
}
const expectedVersion=(value:unknown)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw new HTTPException(400,{message:'expected_version is required'});return value}
export const queueRoutes=new Hono<AppEnv>()
const path='/projects/:projectId/ticket-views'
queueRoutes.get(path,async c=>{
 const actor=await scope(c) as Actor
 const rows=await c.env.DB.prepare("SELECT * FROM ticket_views WHERE project_id=? AND (visibility='shared' OR owner_id=?) ORDER BY name,id").bind(actor.projectId,actor.id).all<ViewRow>()
 return c.json({data:await Promise.all(rows.results.map(row=>visibleDefinition(c.env,actor,row)))})
})
queueRoutes.get(`${path}/:viewId`,async c=>{const a=await scope(c) as Actor;return c.json({data:await visibleDefinition(c.env,a,await readableView(c.env,a,a.projectId,c.req.param('viewId')))})})
queueRoutes.post(path,async c=>{
 const actor=await scope(c) as Actor,input=await definition(c.env,actor,await c.req.json())
 const guard=await viewAuthority(c,actor,input.visibility==='shared')
 const id=crypto.randomUUID(),now=Date.now()
 const result=await c.env.DB.batch([
  c.env.DB.prepare(`INSERT INTO ticket_views(id,project_id,owner_id,name,visibility,filters_json,sort_json,version,created_at,updated_at) SELECT ?,?,?,?,?,?,?,1,?,? WHERE EXISTS(${guard.sql})`).bind(id,actor.projectId,actor.id,input.name,input.visibility,JSON.stringify(input.filters),JSON.stringify(input.sort),now,now,...guard.params),
  viewAudit(c,actor,id,'ticket.view.created',{visibility:input.visibility,filter_count:input.filters.length})
 ])
 if(!result[0].meta.changes)throw new HTTPException(403,{message:'View authority changed; reload before saving'})
 return c.json({data:viewData((await readableView(c.env,actor,actor.projectId,id)))},201)
})
queueRoutes.put(`${path}/:viewId`,async c=>{
 const actor=await scope(c) as Actor,row=await readableView(c.env,actor,actor.projectId,c.req.param('viewId')),body=await c.req.json(),input=await definition(c.env,actor,body),version=expectedVersion(body.expected_version)
 const guard=await viewAuthority(c,actor,row.visibility==='shared'||input.visibility==='shared')
 const result=await c.env.DB.batch([
  c.env.DB.prepare(`UPDATE ticket_views SET name=?,visibility=?,owner_id=?,filters_json=?,sort_json=?,version=version+1,updated_at=? WHERE project_id=? AND id=? AND version=? AND (visibility='shared' OR owner_id=?) AND EXISTS(${guard.sql})`).bind(input.name,input.visibility,input.visibility==='personal'?actor.id:row.owner_id,JSON.stringify(input.filters),JSON.stringify(input.sort),Date.now(),actor.projectId,row.id,version,actor.id,...guard.params),
  viewAudit(c,actor,row.id,'ticket.view.updated',{visibility:input.visibility,version:version+1})
 ])
 if(!result[0].meta.changes)throw new HTTPException(409,{message:'Saved view or authority changed; reload before editing'})
 return c.json({data:viewData(await readableView(c.env,actor,actor.projectId,row.id))})
})
queueRoutes.delete(`${path}/:viewId`,async c=>{
 const actor=await scope(c) as Actor,row=await readableView(c.env,actor,actor.projectId,c.req.param('viewId')),version=expectedVersion(Number(c.req.query('expected_version')))
 const guard=await viewAuthority(c,actor,row.visibility==='shared')
 const result=await c.env.DB.batch([
  c.env.DB.prepare(`DELETE FROM ticket_views WHERE project_id=? AND id=? AND version=? AND (visibility='shared' OR owner_id=?) AND EXISTS(${guard.sql})`).bind(actor.projectId,row.id,version,actor.id,...guard.params),
  viewAudit(c,actor,row.id,'ticket.view.deleted',{visibility:row.visibility})
 ])
 if(!result[0].meta.changes)throw new HTTPException(409,{message:'Saved view or authority changed; reload before deleting'})
 return c.json({deleted:true})
})
queueRoutes.route('/',bulkRoutes)
/** Resolve view privacy before compiling its conditions in the public inbox. */
export async function savedQueue(env:Env,actor:Actor,project:string|undefined,id:string|undefined):Promise<{filters:TicketFilter[];sort:TicketSort[]}|undefined>{
 if(!id)return
 if(!project)throw new HTTPException(400,{message:'Saved views require a workspace'})
 const row=await readableView(env,actor,project,id)
 return {filters:parseFilters(JSON.parse(row.filters_json)),sort:parseSort(JSON.parse(row.sort_json))}
}
