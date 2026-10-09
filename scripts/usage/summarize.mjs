import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'

export function summarize(measurement){
 const phases=Object.fromEntries(measurement.records.map(({phase,events})=>{
  const of=kind=>events.filter(e=>e.kind===kind),d1=of('d1'),known=d1.filter(e=>Number.isFinite(e.meta?.rows_read)&&Number.isFinite(e.meta?.rows_written))
  const sum=key=>known.reduce((n,e)=>n+e.meta[key],0)
  const r2=of('r2'),doRequests=of('do_request')
  return [phase,{
   worker_requests:of('worker').length,worker_local_wall_ms:of('worker').reduce((n,e)=>n+e.wall_ms,0),
   d1:{statements:d1.length,metadata_statements:known.length,missing_metadata_statements:d1.length-known.length,rows_read:d1.length===known.length?sum('rows_read'):null,rows_written:d1.length===known.length?sum('rows_written'):null,known_subset_rows_read:sum('rows_read'),known_subset_rows_written:sum('rows_written')},
   r2:{class_a:r2.filter(e=>['put','list'].includes(e.method)).length,class_b:r2.filter(e=>['get','head'].includes(e.method)).length,uploaded_bytes:r2.filter(e=>e.method==='put').reduce((n,e)=>n+e.size,0),downloaded_bytes:r2.filter(e=>e.method==='get').reduce((n,e)=>n+e.size,0),retained_object_bytes:r2.filter(e=>e.method==='put').reduce((n,e)=>n+e.size,0)},
   do:{requests:doRequests.length,conversation_requests:doRequests.filter(e=>e.object_kind==='conversation').length,project_requests:doRequests.filter(e=>e.object_kind==='project').length,incoming_frames:of('do_frame_in').length,outgoing_frames:measurement.frames.filter(f=>f.phase===phase).length,handler_local_wall_ms:of('do_handler').reduce((n,e)=>n+e.wall_ms,0),peak_socket_attachments:Math.max(0,...of('do_handler').map(e=>e.attachments.length)),peak_socket_attachment_bytes:Math.max(0,...of('do_handler').flatMap(e=>e.attachments))},
   queue_messages:of('queue_send').length+of('queue_batch').reduce((n,e)=>n+e.count,0),queue_consumer_invocations:of('queue_consume').length,cron_invocations:of('cron').length
  }]
 }))
 // Scenario assumes all new visitors, steady 30-day R2 Standard retention, and
 // one post-conversation outbox drain. The measured drain for two conversations
 // contributes two DO fetches each; idle cron contributes no DO calls.
 const per=phases.new_visitor,recoveryPer=phases.recovery_cron.do.requests/2
 const scenarios=[1,1000,10000].map(volume=>{
  const workerRequests=43200+per.worker_requests*volume
  const doRequestEquivalent=(per.do.requests+recoveryPer+per.do.incoming_frames/20)*volume
  const r2GbMonth=per.r2.retained_object_bytes*volume/1e9
  const r2Storage=Math.max(0,Math.ceil(r2GbMonth)-10)*0.015
  const workerOverage=Math.max(0,workerRequests-10000000)/1000000*0.30
  const doOverage=Math.max(0,doRequestEquivalent-1000000)/1000000*0.15
  const r2OperationOverage=Math.max(0,Math.ceil(per.r2.class_a*volume/1000000)-1)*4.50+Math.max(0,Math.ceil(per.r2.class_b*volume/1000000)-10)*0.36
  return {conversations:volume,cron_invocations:43200,worker_requests:workerRequests,do_request_equivalent:doRequestEquivalent,r2_class_a:per.r2.class_a*volume,r2_class_b:per.r2.class_b*volume,r2_gb_month:r2GbMonth,queue_messages:0,d1_total_rows_read:null,d1_total_rows_written:null,priced_component_subtotal_usd:5+r2Storage+workerOverage+doOverage+r2OperationOverage,priced_components:{workers_account_minimum:5,worker_request_overage:workerOverage,do_request_overage:doOverage,r2_operation_overage:r2OperationOverage,r2_storage_overage:r2Storage},excluded_unknowns:['Worker CPU','D1 total rows and hosted storage','DO duration and hosted storage','AI/provider/email','other account usage','observability and ancillary services'],billing_total_usd:null}
 })
 return {phases,scenarios}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw new Error('Usage: node scripts/usage/summarize.mjs measurement.json')
 console.log(JSON.stringify(summarize(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2))
}
