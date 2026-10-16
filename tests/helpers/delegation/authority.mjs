import assert from 'node:assert/strict'
import {applicationsApp} from './applications.mjs'
import {sha} from '../../journeys/kit/app.mjs'

// Delegated authority under concurrency, revision loss and every way current authority ends.
export async function authorityJourney(){
 const t=await applicationsApp('authority-installation'),{run,one,call}=t
 try{
  await run("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('authority','Authority','authority-widget','https://test.example',1)")
  await run("INSERT INTO users(id,email,name,created_at) VALUES('authority-operator','authority@test.example','Operator',1)");await run("INSERT INTO memberships VALUES('authority','authority-operator','operator')")
  await run("INSERT INTO edition_clients(id,project_id,origin,redirect_uri) VALUES('client','authority','https://client.example','https://client.example/callback')")
  await run("INSERT INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at) VALUES('authority-article','authority','authority-guide','Guide','Original','Summary','draft',1)")
  const target='projects/authority/articles/authority-article',token='authority-token',full=JSON.stringify(['knowledge.article.read','knowledge.article.update','knowledge.article.publish'])
  await run('INSERT INTO edition_grants(id,installation_id,client_id,project_id,principal_id,scopes,targets,expires_at,created_at,token_hash) VALUES(?,?,?,?,?,?,?,?,?,?)','authority-grant','authority-installation','client','authority','authority-operator',full,JSON.stringify([target]),Date.now()+86400000,Date.now(),sha(token))
  const api=(path,body,headers={})=>call('/api/delegation/v1'+path,{token,body,headers})
  const source=async()=>{const response=await api('/evidence?target='+target);assert.equal(response.status,200);return response.json()}
  const effect=async key=>({operationKey:key,operation:'happytohelp.article.update',target,expectedRevision:(await source()).revision,expectedAudienceRevision:(await (await api('/audience?'+new URLSearchParams({target,operation:'happytohelp.article.update',intendedStatus:'draft'}))).json()).audienceRevision,content:{title:'Fixed',content:'Exact new content',summary:'Fixed',status:'draft'}})
  assert.equal((await api('/identity',null,{Cookie:'h2h_session=anything'})).status,401,'a cookie never stands in for the bearer grant');assert.equal((await api('/evidence?target=projects/authority/articles/unselected')).status,403)
  // Eight concurrent identical writes make one receipt; conflicting payloads race to one 200 and one 409.
  const payload=await effect('concurrent'),replies=await Promise.all(Array.from({length:8},()=>api('/effects',payload)))
  for(const reply of replies)assert.equal(reply.status,200,await reply.clone().text())
  const receipts=await Promise.all(replies.map(reply=>reply.json()));assert.equal(new Set(receipts.map(r=>r.receipt.id)).size,1);assert.equal((await one("SELECT count(*) n FROM edition_receipts WHERE project_id='authority'")).n,1)
  assert.equal((await source()).revision,receipts[0].receipt.afterRevision)
  const race=await effect('different-payload'),competing=await Promise.all([api('/effects',race),api('/effects',{...race,content:{...race.content,title:'Other'}})])
  assert.deepEqual(competing.map(r=>r.status).sort(),[200,409])
  // Receipts hold hashes only, never the written content.
  const row=await one("SELECT * FROM edition_receipts WHERE project_id='authority' LIMIT 1");assert.ok(!Object.keys(row).some(k=>['content','title','summary'].includes(k)));assert.ok(!JSON.stringify(row).includes('Exact new content'))
  // A client disabled while a receipt is being read ends that read.
  assert.equal((await api('/effects/concurrent',undefined,{'x-test-after-batch':"UPDATE edition_clients SET enabled=0 WHERE project_id='authority'"})).status,401)
  await run("UPDATE edition_clients SET enabled=1 WHERE project_id='authority'")
  // An article deleted and recreated with the same id is a different incarnation.
  const stale=await effect('incarnation');await run("DELETE FROM knowledge_articles WHERE id='authority-article'")
  await run("INSERT INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at) VALUES('authority-article','authority','authority-guide','Fixed','Exact new content','Fixed','draft',1)")
  assert.equal((await api('/effects',stale)).status,409)
  for(const [invalidate,restore] of [
   ["UPDATE edition_grants SET expires_at=1 WHERE id='authority-grant'",`UPDATE edition_grants SET expires_at=${Date.now()+86400000} WHERE id='authority-grant'`],
   ["UPDATE edition_clients SET enabled=0 WHERE project_id='authority'","UPDATE edition_clients SET enabled=1 WHERE project_id='authority'"],
   ["DELETE FROM memberships WHERE project_id='authority'","INSERT INTO memberships VALUES('authority','authority-operator','operator')"],
   ["INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('authority','{\"deleted_at\":1}',1)","DELETE FROM project_settings WHERE project_id='authority'"],
  ]){await run(invalidate);assert.equal((await api('/identity')).status,401,invalidate);assert.equal((await api('/effects/concurrent')).status,401,invalidate);await run(restore);assert.equal((await api('/identity')).status,200)}
  const readOnly=await effect('read-only');await run("UPDATE edition_grants SET scopes=? WHERE id='authority-grant'",JSON.stringify(['knowledge.article.read']))
  assert.equal((await api('/effects',readOnly)).status,403);await run("UPDATE edition_grants SET scopes=? WHERE id='authority-grant'",full)
  assert.equal((await api('/effects',{...await effect('unsupported'),operation:'happytohelp.reply.send'})).status,422)
  // Hash-only receipts survive the runtime stopping and starting again, unchanged.
  const before=await t.app.sql("SELECT * FROM edition_receipts WHERE project_id='authority' ORDER BY operation_key")
  await t.app.configure({});assert.deepEqual(await t.app.sql("SELECT * FROM edition_receipts WHERE project_id='authority' ORDER BY operation_key"),before)
  assert.equal((await api('/effects/concurrent')).status,200)
 }finally{await t.close()}
}
