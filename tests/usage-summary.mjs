import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {summarize} from '../scripts/usage/summarize.mjs'
test('retained raw workload preserves missing D1 metadata and excludes unmeasured billing',async()=>{
 const raw=JSON.parse(await readFile(new URL('../docs/usage/measurement-2026-09-29.json',import.meta.url),'utf8'))
 const result=summarize(raw)
 for(const name of ['new_visitor','returning_visitor']){
  const phase=result.phases[name]
  assert.equal(phase.d1.rows_read,null);assert.equal(phase.d1.rows_written,null);assert.ok(phase.d1.missing_metadata_statements>0)
  assert.equal(phase.r2.uploaded_bytes,1048576);assert.equal(phase.r2.downloaded_bytes,1048576)
  assert.equal(phase.do.incoming_frames,1);assert.equal(phase.do.outgoing_frames,6)
  assert.equal(phase.queue_messages,0)
 }
 assert.equal(result.phases.new_visitor.worker_requests-result.phases.returning_visitor.worker_requests,1)
 assert.equal(raw.ai.provider_call_count,0);assert.equal(raw.ai.cost_usd,null)
 assert.ok(result.scenarios.every(s=>s.billing_total_usd===null&&s.d1_total_rows_read===null))
 assert.equal(result.scenarios.at(-1).priced_components.r2_storage_overage,0.015)
 assert.equal(result.scenarios[0].worker_requests,43212)
})
