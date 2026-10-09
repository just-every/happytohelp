import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)}})
const {Hono}=await import('hono')
const {delegation}=await import('../src/edition/delegation/routes.ts')
const {hashToken}=await import('../src/platform/auth.ts')
export async function authorityContract(DB){
 const app=new Hono().route('/api/delegation/v1',delegation),env={DB,RER_INSTALLATION_ID:'authority-installation'}
 const run=(sql,...args)=>DB.prepare(sql).bind(...args).run()
 const one=(sql,...args)=>DB.prepare(sql).bind(...args).first()
 await run("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('authority','Authority','authority-widget','https://test.example',1)")
 await run("INSERT INTO users(id,email,name,created_at) VALUES('authority-operator','authority@test.example','Operator',1)")
 await run("INSERT INTO memberships VALUES('authority','authority-operator','operator')")
 await run("INSERT INTO edition_clients(id,project_id,origin,redirect_uri) VALUES('client','authority','https://client.example','https://client.example/callback')")
 await run("INSERT INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at) VALUES('authority-article','authority','authority-guide','Guide','Original','Summary','draft',1)")
 const target='projects/authority/articles/authority-article',token='authority-token'
 await run('INSERT INTO edition_grants(id,installation_id,client_id,project_id,principal_id,scopes,targets,expires_at,created_at,token_hash) VALUES(?,?,?,?,?,?,?,?,?,?)','authority-grant',env.RER_INSTALLATION_ID,'client','authority','authority-operator',JSON.stringify(['knowledge.article.read','knowledge.article.update','knowledge.article.publish']),JSON.stringify([target]),Date.now()+86400000,Date.now(),await hashToken(token))
 const call=(path,body,headers={})=>app.request('https://h2h.test/api/delegation/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined},env)
 const source=async()=>{const r=await call('/evidence?target='+target);assert.equal(r.status,200);return r.json()}
 const effect=async(key)=>({operationKey:key,operation:'happytohelp.article.update',target,expectedRevision:(await source()).revision,expectedAudienceRevision:(await (await call('/audience?'+new URLSearchParams({target,operation:'happytohelp.article.update',intendedStatus:'draft'}))).json()).audienceRevision,content:{title:'Fixed',content:'Exact new content',summary:'Fixed',status:'draft'}})
 assert.equal((await call('/identity',null,{Cookie:'h2h_session=anything'})).status,401)
 assert.equal((await call('/evidence?target=projects/authority/articles/unselected')).status,403)
 const payload=await effect('concurrent')
 const replies=await Promise.all(Array.from({length:8},()=>call('/effects',payload)))
 for(const reply of replies)assert.equal(reply.status,200,await reply.clone().text())
 const receipts=await Promise.all(replies.map(r=>r.json()))
 assert.equal(new Set(receipts.map(r=>r.receipt.id)).size,1)
 assert.equal((await one("SELECT count(*) n FROM edition_receipts WHERE project_id='authority'")).n,1)
 assert.equal((await source()).revision,receipts[0].receipt.afterRevision)
 const race=await effect('different-payload')
 const competing=await Promise.all([call('/effects',race),call('/effects',{...race,content:{...race.content,title:'Other'}})])
 assert.deepEqual(competing.map(r=>r.status).sort(),[200,409])
 const row=await one("SELECT * FROM edition_receipts WHERE project_id='authority' LIMIT 1")
 assert.ok(!Object.keys(row).some(k=>['content','title','summary'].includes(k)))
 assert.ok(!JSON.stringify(row).includes('Exact new content'))
 const racedDB={prepare:DB.prepare.bind(DB),async batch(statements){const result=await DB.batch(statements);await run("UPDATE edition_clients SET enabled=0 WHERE project_id='authority'");return result}}
 const racedRead=await app.request('https://h2h.test/api/delegation/v1/effects/concurrent',{headers:{Authorization:'Bearer '+token}},{...env,DB:racedDB})
 assert.equal(racedRead.status,401)
 await run("UPDATE edition_clients SET enabled=1 WHERE project_id='authority'")
 const stale=await effect('incarnation')
 await run("DELETE FROM knowledge_articles WHERE id='authority-article'")
 await run("INSERT INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at) VALUES('authority-article','authority','authority-guide','Fixed','Exact new content','Fixed','draft',1)")
 assert.equal((await call('/effects',stale)).status,409)
 for(const [invalidate,restore] of [
  ["UPDATE edition_grants SET expires_at=1 WHERE id='authority-grant'",`UPDATE edition_grants SET expires_at=${Date.now()+86400000} WHERE id='authority-grant'`],
  ["UPDATE edition_clients SET enabled=0 WHERE project_id='authority'","UPDATE edition_clients SET enabled=1 WHERE project_id='authority'"],
  ["DELETE FROM memberships WHERE project_id='authority'","INSERT INTO memberships VALUES('authority','authority-operator','operator')"],
  ["INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('authority','{\"deleted_at\":1}',1)","DELETE FROM project_settings WHERE project_id='authority'"]
 ]){await run(invalidate);assert.equal((await call('/identity')).status,401);assert.equal((await call('/effects/concurrent')).status,401);await run(restore);assert.equal((await call('/identity')).status,200)}
 const readOnlyPayload=await effect('read-only')
 const full=JSON.stringify(['knowledge.article.read','knowledge.article.update','knowledge.article.publish'])
 await run("UPDATE edition_grants SET scopes=? WHERE id='authority-grant'",JSON.stringify(['knowledge.article.read']))
 assert.equal((await call('/effects',readOnlyPayload)).status,403)
 await run("UPDATE edition_grants SET scopes=? WHERE id='authority-grant'",full)
 assert.equal((await call('/effects',{...await effect('unsupported'),operation:'happytohelp.reply.send'})).status,422)
 console.log('Authority regression: eight concurrent identical writes, concurrent conflicting payloads, hash-only durable receipts, article reincarnation, expiry, client disable, operator membership, project deletion, scope and cookie isolation passed')
}
