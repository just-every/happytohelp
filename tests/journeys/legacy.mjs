import test from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {startApp,sha} from './kit/app.mjs'
import {legacyBundle} from '../helpers/legacy-bundle.mjs'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
// The importer behind scripts/import-legacy.mjs, applied to the application's own D1 and R2.
const {importLegacy,planImport}=await import('../../src/modules/legacy-import/importer.ts')
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

test('the legacy command plans without writing and refuses remote use; an applied export replays as a no-op, a conflicting row fails without overwriting, and corrupt media is refused',async()=>{
 const {bundle}=await legacyBundle(),scratch=await mkdtemp(join(tmpdir(),'h2h-legacy-'))
 try{
  const file=join(scratch,'export.json');await writeFile(file,JSON.stringify(bundle))
  const planned=JSON.parse((await exec(process.execPath,['scripts/import-legacy.mjs','--file',file])).stdout);assert.ok(planned.id);assert.ok(Object.keys(planned).length>1)
  await assert.rejects(exec(process.execPath,['scripts/import-legacy.mjs','--file',file,'--remote']),/Local only/)
  const broken=structuredClone(bundle);broken.objects[0].sha256='0'.repeat(64);await assert.rejects(planImport(broken),/digest mismatch/)
  const app=await startApp()
  try{
   const env={DB:app.db,FILES:await app.files},first=await importLegacy(env,bundle),replay=await importLegacy(env,bundle);assert.equal(replay.applied,0);assert.equal(replay.replayed,first.applied)
   const conflict=structuredClone(bundle);conflict.tables.messages[1].content='Changed historical source';await assert.rejects(importLegacy(env,conflict),/Existing data conflict/)
   assert.equal((await app.first("SELECT content FROM messages WHERE id='m2'")).content,'Prior answer')
  }finally{await app.close()}
 }finally{await rm(scratch,{recursive:true,force:true})}
})
