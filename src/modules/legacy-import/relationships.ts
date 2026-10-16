import {type LegacyBundle,type Row,timestamp} from './types'
// Build once per mapping context, rather than scanning every conversation's
// full transcript for each imported row in a production-sized project.
const cache=new WeakMap<LegacyBundle,ReturnType<typeof build>>()
function build(bundle:LegacyBundle){
 const ids=new Map<string,Map<string,Row>>()
 for(const [table,rows]of Object.entries(bundle.tables))ids.set(table,new Map(rows.filter(r=>r.id!==undefined).map(r=>[String(r.id),r])))
 const messages=new Map<string,Row[]>()
 for(const row of bundle.tables.messages||[])if(!row.deleted_at){const id=String(row.conversation_id);if(!messages.has(id))messages.set(id,[]);messages.get(id)!.push(row)}
 const revisions=new Map<string,number>()
 for(const rows of messages.values()){rows.sort((a,b)=>timestamp(a.created_at)-timestamp(b.created_at)||String(a.id).localeCompare(String(b.id)));rows.forEach((r,i)=>revisions.set(String(r.id),i+1))}
 const mediaMessages=new Map((bundle.tables.mediables||[]).filter(r=>String(r.mediable_type).endsWith('Message')).map(r=>[String(r.media_id),r]))
 return {find:(table:string,id:unknown)=>ids.get(table)?.get(String(id)),messages,revisions,mediaMessages}
}
export function relationships(bundle:LegacyBundle){let result=cache.get(bundle);if(!result){result=build(bundle);cache.set(bundle,result)}return result}
