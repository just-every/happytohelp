import {phases} from '../journeys/kit/scenarios.mjs';
const test=phases(import.meta.url);
import assert from 'node:assert/strict';
import {nativeHarness} from './harness.mjs';
import {generate} from './generator.mjs';
const base='/api/move-in/projects/p/imports',post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function review(h,records){const body=records.map(JSON.stringify).join('\n')+'\n';assert.ok(Buffer.byteLength(body)<2*1024*1024);const run=(await h.call(`${base}?vendor=zendesk`,{method:'POST',headers:{'X-Import-Filename':'bounded.jsonl'},body})).data;await h.drain();return (await h.call(`${base}/${run.id}`)).data}
test('derived unique tag records count toward the displayed source record limit',async()=>{const h=await nativeHarness();try{
 const records=generate('zendesk',2).trim().split('\n').map(JSON.parse),tickets=records.filter(r=>r.ticket);tickets[0].ticket.tags=Array.from({length:2500},(_,i)=>`first-${i}`);tickets[1].ticket.tags=Array.from({length:2500},(_,i)=>`second-${i}`);const run=await review(h,records);assert.equal(run.error,'export_record_limit');assert.equal(run.plan,null);assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM conversations').first()).n,0);assert.equal(h.outbound,0)
 }finally{await h.close()}});
test('a 3,000-ticket export reaches review',async()=>{const h=await nativeHarness();try{
 const run=await review(h,generate('zendesk',3000).trim().split('\n').map(JSON.parse));assert.equal(run.error,null);assert.equal(run.state,'ready');assert.equal(run.plan.counts.byKind.ticket,3000)
 }finally{await h.close()}});
for(const count of [200,400])test(`a ${count}-comment conversation is ${count===200?'applied within one invocation budget':'rejected in review before native writes'}`,async()=>{const h=await nativeHarness();try{
 const records=generate('zendesk',1).trim().split('\n').map(JSON.parse),ticket=records.find(r=>r.ticket).ticket;ticket.comments=Array.from({length:count},(_,i)=>({id:i+1,author_id:1,public:true,body:`Comment ${i}`,created_at:'2024-01-01T00:00:00Z'}));const run=await review(h,records);assert.equal(run.state,'ready');const decision=run.plan.decisions.find(d=>d.kind==='ticket');assert.equal(decision.location.artifact,'bounded.jsonl');assert.equal(decision.location.row,3);
 if(count===400){assert.equal(decision.rejection,'native_record_statement_limit');assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM conversations').first()).n,0)}else{assert.equal(decision.rejection,undefined);await h.call(`${base}/${run.id}/apply`,post({fingerprint:run.plan.fingerprint}));await h.drain();assert.equal((await h.call(`${base}/${run.id}`)).data.state,'completed');assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM messages').first()).n,200);assert.ok(h.maxStatements<=1000);await h.call(`${base}/${run.id}/undo`,post({}));await h.drain();assert.equal((await h.call(`${base}/${run.id}`)).data.state,'undone');assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM conversations').first()).n,0)}assert.equal(h.outbound,0)
 }finally{await h.close()}});
