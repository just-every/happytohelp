import test from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,writeFile,readFile,rm,cp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {startApp,sha} from './kit/app.mjs'
import {legacyBundle} from '../helpers/legacy-bundle.mjs'
import {writeLegacyPackage} from '../helpers/legacy-package.mjs'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
// The importer behind scripts/import-legacy.mjs, applied to the application's own D1 and R2.
const {importLegacy,planImport}=await import('../../src/modules/legacy-import/importer.ts')
const packageModules={planImport,importLegacy,tableOrder:(await import('../../src/modules/legacy-import/mapping.ts')).tableOrder,relationships:await import('../../src/modules/legacy-import/relationships.ts'),types:await import('../../src/modules/legacy-import/types.ts')}
const {importPackage}=await import('../../scripts/legacy-import/import-package.mjs')
const exec=promisify(execFile)

test('an actual-shaped legacy export lands with original IDs, transcript order, media bytes and published knowledge only; pending paid work, old devices and money stay inert custody; native routes read it back',async()=>{
 const app=await startApp(),{bundle,media,date}=await legacyBundle()
 try{
  const env={DB:app.db,FILES:await app.files},q=(sql,...args)=>app.first(sql,...args)
  const result=await importLegacy(env,bundle);assert.equal(result.applied,Object.values(bundle.tables).flat().length);assert.equal(result.objects,1);assert.equal(result.archivedOnly.length,4)
  assert.equal(JSON.parse((await q("SELECT metadata_json FROM contacts WHERE id='c'")).metadata_json).is_blocked,true,'a blocked legacy contact stays blocked')
  assert.equal((await q("SELECT assigned_to FROM conversations WHERE id='conv'")).assigned_to,null);assert.equal((await q("SELECT ai_id FROM conversation_ai WHERE conversation_id='conv'")).ai_id,'ai');assert.equal((await q("SELECT assigned_to FROM conversations WHERE id='human-conv'")).assigned_to,'u')
  assert.equal((await q("SELECT resolved_at FROM conversations WHERE id='conv'")).resolved_at,Date.parse(date));assert.deepEqual(await q("SELECT revision,last_message_id FROM conversations WHERE id='conv'"),{revision:2,last_message_id:'m2'});assert.equal((await q("SELECT bucket_id FROM messages WHERE id='m1'")).bucket_id,'bucket-original')
  // Unknown outcomes never resume as live work: generations, training and billing are uncertain; delegations lose authority.
  assert.equal((await q("SELECT state FROM ai_generations WHERE id='gen'")).state,'uncertain');assert.equal((await q("SELECT status FROM training_runs WHERE id='run'")).status,'uncertain');assert.equal((await q("SELECT state FROM billing_operations WHERE id='bill-op'")).state,'uncertain')
  assert.deepEqual({...await q("SELECT status,delivery_state,cancel_requested,completed_at FROM local_jobs WHERE id='job'")},{status:'revoked',delivery_state:'authority_revoked',cancel_requested:1,completed_at:date})
  assert.deepEqual({...await q("SELECT status,delivery_state,cancel_requested FROM local_jobs WHERE id='job-queued'")},{status:'cancelled',delivery_state:'held',cancel_requested:1})
  assert.equal((await q("SELECT amount_minor FROM billing_ledger WHERE id='charge'")).amount_minor,123,'historical money is retained exactly as custody');assert.ok((await q('SELECT COUNT(*) n FROM legacy_import_holds')).n>=6)
  assert.equal(await (await env.FILES.get('legacy/file')).text(),media.toString());assert.equal((await q("SELECT role FROM memberships WHERE user_id='u'")).role,'owner')
  assert.equal((await q("SELECT prompt FROM ai_profiles WHERE id='ai'")).prompt,'Actual inherited legacy prompt');assert.equal(JSON.parse((await q("SELECT settings_json FROM project_settings WHERE project_id='p'")).settings_json).is_human_response_enabled,false)
  assert.equal((await q("SELECT published_version FROM knowledge_datasets WHERE id='draft-ds'")).published_version,null);assert.equal((await q("SELECT COUNT(*) n FROM knowledge_documents WHERE id IN ('draft-file','refresh-candidate')")).n,0,'unpublished drafts and refresh candidates never publish');assert.equal((await q("SELECT COUNT(*) n FROM knowledge_documents WHERE id IN ('ready-file','old-published')")).n,2)
  // Native readback: the legacy password never signs in; a native session reads the transcript, its media and the published article.
  assert.equal((await app.call('/api/identity/login',{body:{email:'import@example.com',password:'synthetic-retained-only-legacy-hash'}})).status,401,'old password hashes are archive custody, not credentials')
  await app.db.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,?,?,?,?)').bind(sha('legacy-owner'),'u','p','owner',Date.now()+3600000).run()
  const transcript=(await app.call('/api/conversations/conv/messages',{token:'legacy-owner',status:200})).data;assert.deepEqual(transcript.messages.map(message=>[message.id,message.content]),[['m1','Prior message'],['m2','Prior answer']])
  const file=transcript.messages[0].media[0];assert.equal(file.filename,'note.txt');const bytes=await app.request(`/api/conversations/conv/media/${file.id}`,{token:'legacy-owner'});assert.equal(bytes.status,200);assert.equal(await bytes.text(),media.toString())
  assert.ok((await app.call('/api/dashboard/projects/p/conversations?view=all',{token:'legacy-owner'})).data.data.some(row=>row.id==='conv'))
  assert.equal((await q("SELECT status FROM knowledge_articles WHERE id='article'")).status,'published')
  assert.equal(app.requests.length,0,'importing calls no provider')
 }finally{await app.close()}
})

test('the legacy command plans without writing and applies remotely only with named installation resources and deploy credentials; an applied export replays as a no-op, a conflicting row fails without overwriting, and corrupt media is refused',async()=>{
 const {bundle}=await legacyBundle(),scratch=await mkdtemp(join(tmpdir(),'h2h-legacy-'))
 try{
  const file=join(scratch,'export.json');await writeFile(file,JSON.stringify(bundle))
  const planned=JSON.parse((await exec(process.execPath,['scripts/import-legacy.mjs','--file',file])).stdout);assert.ok(planned.id);assert.ok(Object.keys(planned).length>1)
  await assert.rejects(exec(process.execPath,['scripts/import-legacy.mjs','--file',file,'--remote']),/Usage/)
  const noCredentials={...process.env};delete noCredentials.CLOUDFLARE_API_TOKEN;delete noCredentials.CLOUDFLARE_ACCOUNT_ID
  await assert.rejects(exec(process.execPath,['scripts/import-legacy.mjs','--package',scratch,'--apply','--remote','--database','d1','--bucket','r2'],{env:noCredentials}),/deploy credentials/)
  const broken=structuredClone(bundle);broken.objects[0].sha256='0'.repeat(64);await assert.rejects(planImport(broken),/digest mismatch/)
  const app=await startApp()
  try{
   const env={DB:app.db,FILES:await app.files},first=await importLegacy(env,bundle),replay=await importLegacy(env,bundle);assert.equal(replay.applied,0);assert.equal(replay.replayed,first.applied)
   const conflict=structuredClone(bundle);conflict.tables.messages[1].content='Changed historical source';await assert.rejects(importLegacy(env,conflict),/Existing data conflict/)
   assert.equal((await app.first("SELECT content FROM messages WHERE id='m2'")).content,'Prior answer')
  }finally{await app.close()}
 }finally{await rm(scratch,{recursive:true,force:true})}
})

test('a chunked legacy package imports one chunk at a time into the same native rows as the whole export; a damaged package writes nothing, a dropped connection resumes and a rerun replays every row',async()=>{
 const {bundle,media,date}=await legacyBundle(),scratch=await mkdtemp(join(tmpdir(),'h2h-legacy-package-'))
 // Chunks of one row: the earliest message arrives last, a legacy widget delivered one local ID twice, and notes and assignments arrive as legacy events.
 bundle.tables.messages.push({id:'m0',project_id:'p',conversation_id:'conv',contact_id:'c',local_id:'widget-retry',content:'Earliest message',created_at:'2025-12-31T23:59:59.000Z'},{id:'m3',project_id:'p',conversation_id:'conv',contact_id:'c',local_id:'widget-retry',content:'Repeated delivery',created_at:'2026-01-01T00:00:02.000Z'})
 bundle.tables.events=[{id:'event-note',type:'INTERNAL_NOTE',conversation_id:'conv',agent_id:'u',payload:'Private package note',created_at:date},{id:'event-assigned',type:'AGENT_ASSIGNED',conversation_id:'human-conv',agent_id:'u',payload:'{"agent_id":"u"}',created_at:date}]
 const root=join(scratch,'package'),{manifestSha256}=await writeLegacyPackage(root,bundle,{rowsPerChunk:1}),whole=await startApp(),app=await startApp()
 try{
  await importLegacy({DB:whole.db,FILES:await whole.files},bundle)
  const env={DB:app.db,FILES:await app.files},total=Object.values(bundle.tables).flat().length
  const damaged=join(scratch,'damaged');await cp(root,damaged,{recursive:true});const chunk=join(damaged,'rows-000003.json'),text=await readFile(chunk,'utf8');await writeFile(chunk,text.replace(/"id":"(.)/,(_,c)=>`"id":"${c==='x'?'y':'x'}`))
  await assert.rejects(importPackage(damaged,env,packageModules),/digest mismatch/);await assert.rejects(importPackage(root,env,packageModules,{expectManifestSha256:'0'.repeat(64)}),/digest differs/)
  assert.equal((await app.first('SELECT COUNT(*) n FROM legacy_import_runs')).n,0,'a damaged or unexpected package is refused before any write')
  let batches=0;const dropping={FILES:env.FILES,DB:new Proxy(env.DB,{get(target,key){if(key==='batch')return async statements=>{if(++batches>5)throw new Error('connection lost');return target.batch(statements)};const value=target[key];return typeof value==='function'?value.bind(target):value}})}
  await assert.rejects(importPackage(root,dropping,packageModules),/connection lost/)
  const resumed=await importPackage(root,env,packageModules,{expectManifestSha256:manifestSha256});assert.deepEqual([resumed.replayed,resumed.applied,resumed.sourceRows],[5,total-5,total])
  const replay=await importPackage(root,env,packageModules);assert.deepEqual([replay.applied,replay.replayed],[0,total])
  // Native publication triggers give each install's article its own random incarnation.
  const rows=async(target,table)=>(await target.sql(`SELECT * FROM ${table}`)).map(({source_incarnation,publication_version,...row})=>JSON.stringify(row)).sort()
  for(const table of ['projects','project_settings','public_project_aliases','email_settings','users','memberships','contacts','conversations','conversation_ai','conversation_buckets','messages','conversation_notes','context_tracked_events','media','ai_profiles','knowledge_datasets','knowledge_documents','knowledge_articles','local_jobs','billing_ledger'])assert.deepEqual(await rows(app,table),await rows(whole,table),table)
  assert.equal(await (await env.FILES.get('legacy/file')).text(),media.toString())
  await app.db.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,?,?,?,?)').bind(sha('package-owner'),'u','p','owner',Date.now()+3600000).run()
  assert.deepEqual((await app.call('/api/conversations/conv/messages',{token:'package-owner',status:200})).data.messages.map(message=>[message.id,message.local_id]),[['m0','widget-retry'],['m1','legacy:m1'],['m2','legacy:m2'],['m3','legacy:m3']])
  assert.equal((await app.first("SELECT content FROM conversation_notes WHERE id='event-note'")).content,'Private package note')
  assert.equal(app.requests.length,0,'importing calls no provider')
 }finally{await whole.close();await app.close();await rm(scratch,{recursive:true,force:true})}
})
