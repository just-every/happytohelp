import {migrationStatements} from './helpers/migration-statements.mjs';
import {createRequire} from 'node:module'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]})),{Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
const compiled=await build({entryPoints:['tests/conversation-worker.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],logLevel:'silent'})
const mf=new Miniflare(convertV4MiniflareOptions({name:'conversation-test',modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}},bindings:{H2H_SETUP_TOKEN:'synthetic-socket-fixture-setup-token-0123456789abcdef'}}))
try{
const DB=await mf.getD1Database('DB');for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort())for(const sql of migrationStatements(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))await DB.prepare(sql).run()
async function api(path,body,token,extra={}){return mf.dispatchFetch('https://app.example/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)})}
const owner=await(await api('identity/bootstrap',{password:'synthetic-test-setup-password-123',email:'socket@example.com',name:'Socket',allowedOrigin:'https://widget.example',setupToken:'synthetic-socket-fixture-setup-token-0123456789abcdef'})).json();const project=await DB.prepare('SELECT widget_key FROM projects WHERE id=?').bind(owner.projectId).first()
const contact=await(await api('identity/widget/session',{widgetKey:project.widget_key},undefined,{Origin:'https://widget.example'})).json();const other=await(await api('identity/widget/session',{widgetKey:project.widget_key},undefined,{Origin:'https://widget.example'})).json()
const conv=await(await api('conversations',{projectId:owner.projectId},contact.token)).json();const message=await(await api(`conversations/${conv.id}/messages`,{localId:'one',content:'Persistent message',expectedRevision:0},contact.token)).json();assert.equal(message.accepted,true)
await DB.prepare("UPDATE messages SET content_raw='Private original email body' WHERE id=?").bind(message.message.id).run()
assert.equal((await api(`conversations/${conv.id}/messages`,undefined,other.token)).status,404)
const bad=await mf.dispatchFetch(`https://app.example/api/conversations/${conv.id}/socket?token=${contact.token}`,{headers:{Upgrade:'websocket',Origin:'https://foreign.example'}});assert.equal(bad.status,403)
const response=await mf.dispatchFetch(`https://app.example/api/conversations/${conv.id}/socket?token=${contact.token}`,{headers:{Upgrade:'websocket',Origin:'https://widget.example'}});assert.equal(response.status,101);const socket=response.webSocket;socket.accept();const next=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('socket timeout')),3000);socket.addEventListener('message',event=>{clearTimeout(timer);resolve(JSON.parse(event.data))},{once:true})});const replay=await next();assert.equal(replay.message.content,'Persistent message');assert.equal(replay.type,'message');assert.equal('content_raw' in replay.message,false,'the original email body is operator-only')
const projectResponse=await mf.dispatchFetch(`https://app.example/api/projects/${owner.projectId}/socket`,{headers:{Upgrade:'websocket',Cookie:`h2h_session=${owner.token}`,Origin:'https://app.example'}});assert.equal(projectResponse.status,101);projectResponse.webSocket.accept();const projectFrame=await new Promise(resolve=>projectResponse.webSocket.addEventListener('message',e=>resolve(JSON.parse(e.data)),{once:true}));assert.equal(projectFrame.type,'conversation');assert.equal(projectFrame.conversationId,conv.id);projectResponse.webSocket.close();assert.equal((await mf.dispatchFetch(`https://app.example/api/projects/${owner.projectId}/socket?token=${contact.token}`,{headers:{Upgrade:'websocket',Origin:'https://app.example'}})).status,403)
const namespace=await mf.getDurableObjectNamespace('CONVERSATIONS');const doStub=namespace.get(namespace.idFromName(conv.id));const publicEvent=next();await doStub.fetch('https://conversation.internal/event',{method:'POST',body:JSON.stringify({conversationId:conv.id,type:'private-suggestion',operatorOnly:true})});await doStub.fetch('https://conversation.internal/event',{method:'POST',body:JSON.stringify({conversationId:conv.id,type:'public-delta'})});assert.equal((await publicEvent).type,'public-delta','contact must not receive operator-only frames')
const cookie=await mf.dispatchFetch(`https://app.example/api/conversations/${conv.id}/socket?after=${replay.eventId}`,{headers:{Upgrade:'websocket',Cookie:`h2h_session=${owner.token}`,Origin:'https://app.example'}});assert.equal(cookie.status,101);cookie.webSocket.accept();cookie.webSocket.close()

// Two current operators: private-note invalidation crosses sockets, content stays
// behind the authenticated bucket route, and a reconnect reads retained history.
await DB.prepare("INSERT INTO users VALUES('teammate','teammate@example.test','Morgan Support',1)").run()
await DB.prepare("INSERT INTO memberships VALUES(?,'teammate','operator')").bind(owner.projectId).run()
const hashToken=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('')
await DB.prepare("INSERT INTO sessions VALUES(?,'teammate',?,'operator',NULL,?,NULL)").bind(await hashToken('teammate-token'),owner.projectId,Date.now()+60000).run()
const observer=await mf.dispatchFetch(`https://app.example/api/conversations/${conv.id}/socket?after=${replay.eventId}`,{headers:{Upgrade:'websocket',Authorization:'Bearer teammate-token',Origin:'https://app.example'}})
assert.equal(observer.status,101);observer.webSocket.accept()
const activity=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('note did not reach teammate')),3000);observer.webSocket.addEventListener('message',e=>{const f=JSON.parse(e.data);if(f.type==='activity'){clearTimeout(timer);resolve(f)}},{once:true})})
const privateContent='Customer is waiting for the ChargeDesk webhook trace; Morgan will follow up.'
const note=await api(`dashboard/projects/${owner.projectId}/conversations/${conv.id}/notes`,{content:privateContent},owner.token)
assert.equal(note.status,201,await note.clone().text());assert.equal((await activity).kind,'note')
const visitorFrame=next();await doStub.fetch('https://conversation.internal/event',{method:'POST',body:JSON.stringify({conversationId:conv.id,type:'public-sentinel'})});assert.equal((await visitorFrame).type,'public-sentinel','private note activity is never delivered to visitor')
const retained=await(await api(`dashboard/projects/${owner.projectId}/conversations/${conv.id}/buckets`,undefined,'teammate-token')).json()
assert.ok(retained.data.flatMap(b=>b.events).some(e=>e.content===privateContent),'teammate refresh reads committed note')
observer.webSocket.close()
const reply=await(await api(`conversations/${conv.id}/messages`,{localId:'support-reply',content:'The webhook trace is ready for you.',expectedRevision:1},owner.token)).json()
assert.equal(reply.accepted,true)
const beforeRead=Date.now()
assert.equal((await api(`conversations/${conv.id}/widget-events`,{action:'markAsRead',data:{ids:[reply.message.id]}},contact.token)).status,200)
const read=await DB.prepare("SELECT created_at read_at FROM context_tracked_events WHERE type='MESSAGE_READ' AND json_extract(payload,'$.message_id')=? AND json_extract(payload,'$.reader_id')=?").bind(reply.message.id,contact.contactId).first()
assert.ok(read.read_at>=beforeRead&&read.read_at<=Date.now(),'server timestamps actual first read')
await api(`conversations/${conv.id}/widget-events`,{action:'markAsRead',data:{ids:[reply.message.id]}},contact.token)
assert.equal((await DB.prepare("SELECT created_at read_at FROM context_tracked_events WHERE type='MESSAGE_READ' AND json_extract(payload,'$.message_id')=? AND json_extract(payload,'$.reader_id')=?").bind(reply.message.id,contact.contactId).first()).read_at,read.read_at,'reread retains first timestamp')
const projection=await(await api(`dashboard/projects/${owner.projectId}/conversations/${conv.id}/buckets`,undefined,'teammate-token')).json()
assert.equal(projection.data.flatMap(b=>b.messages).find(m=>m.id===reply.message.id).read_by_contacts[contact.contactId],new Date(read.read_at).toISOString())
assert.ok(projection.data.flatMap(b=>b.events).some(e=>e.type==='AGENT_ASSIGNED'&&e.payload.name==='Socket'),'operator takeover writes attributed handoff history')
await DB.prepare('UPDATE sessions SET revoked_at=? WHERE actor_id=?').bind(Date.now(),contact.contactId).run();const closed=new Promise(resolve=>socket.addEventListener('close',resolve,{once:true}));socket.send(JSON.stringify({type:'ping'}));await closed
assert.equal((await mf.dispatchFetch(`https://app.example/api/conversations/${conv.id}/socket?token=${contact.token}`,{headers:{Upgrade:'websocket',Origin:'https://widget.example'}})).status,401)
console.log('Emitted Worker: scoped REST, foreign contact denial, origin denial, durable socket replay, cookie upgrade, operator project stream, private-frame exclusion and session revocation passed')
}finally{await mf.dispose()}
