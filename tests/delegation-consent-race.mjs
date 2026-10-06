import assert from 'node:assert/strict'
import {Hono} from 'hono'
import {consent} from '../src/edition/delegation/consent.ts'
import {hashToken} from '../src/platform/auth.ts'
/** Exercise a real D1 change between the native preflight and atomic consent batch. */
export async function consentRace(DB){
 const run=(sql,...args)=>DB.prepare(sql).bind(...args).run()
 await run("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('consent-race','Consent','consent-widget','https://test.example',1)")
 await run("INSERT INTO memberships VALUES('consent-race','authority-operator','operator')")
 await run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',await hashToken('consent-session'),'authority-operator','consent-race','operator',Date.now()+86400000)
 await run("INSERT INTO edition_clients(id,project_id,origin,redirect_uri) VALUES('race-client','consent-race','https://client.example','https://client.example/callback')")
 const app=new Hono().route('/delegation',consent),env={DB,RER_INSTALLATION_ID:'authority-installation'}
 const query=new URLSearchParams({client_id:'race-client',account_id:'consent-race',redirect_uri:'https://client.example/callback',response_type:'code',state:'state',code_challenge:'a'.repeat(43),code_challenge_method:'S256',scope:'knowledge.article.read',targets:JSON.stringify(['projects/consent-race/articles/article'])})
 const get=await app.request('https://h2h.test/delegation/authorize/request?'+query,{headers:{Cookie:'h2h_session=consent-session'}},env)
 assert.equal(get.status,200)
 const badQuery=new URLSearchParams(query);badQuery.set('redirect_uri','https://client.example/callback/extra');assert.equal((await app.request('https://h2h.test/delegation/authorize/request?'+badQuery,{headers:{Cookie:'h2h_session=consent-session'}},env)).status,400)
 const page=(await get.json()).data,body={decision:'approve',request:JSON.stringify(page.request),issued:String(page.issued),csrf:page.csrf}
 const cancelQuery=new URLSearchParams(query);cancelQuery.set('state','cancel-state')
 const cancelPage=(await (await app.request('https://h2h.test/delegation/authorize/request?'+cancelQuery,{headers:{Cookie:'h2h_session=consent-session'}},env)).json()).data,cancelBody={decision:'deny',request:JSON.stringify(cancelPage.request),issued:String(cancelPage.issued),csrf:cancelPage.csrf}
 const post=body=>app.request('https://h2h.test/delegation/authorize',{method:'POST',headers:{Cookie:'h2h_session=consent-session',Origin:'https://h2h.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)},env)
 const cancelled=await post(cancelBody);assert.equal(cancelled.status,303);assert.equal(cancelled.headers.get('location'),'/delegation/settings?account_id=consent-race&cancelled=1');assert.equal((await post({...cancelBody,decision:'approve'})).status,400)
 let batches=0
 const gated={prepare:DB.prepare.bind(DB),async batch(statements){batches++;await run("INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES('consent-race','{\"deleted_at\":1}',1)");return DB.batch(statements)}}
 const response=await app.request('https://h2h.test/delegation/authorize',{method:'POST',headers:{Cookie:'h2h_session=consent-session',Origin:'https://h2h.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)},{...env,DB:gated})
 assert.equal(batches,1);assert.equal(response.status,400)
 assert.equal((await DB.prepare("SELECT count(*) n FROM edition_grants WHERE project_id='consent-race'").first()).n,0)
 console.log('Consent regression: cancelled consent cannot be approved later; exact callback checked; race: project deletion after native preflight atomically refuses grant and code issuance')
}
