import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const {routes,dashboardRoutes,publicWidget,widgetEvents}=await import('../src/modules/management/index.ts')
const {inboundEmail}=await import('../src/modules/integrations/index.ts')
const {updateEmailSettings}=await import('../src/modules/integrations/mailbox-settings.ts')
const {hashToken}=await import('../src/platform/auth.ts')
const {getPlatformProxy}=await import('wrangler')
const proxy=await getPlatformProxy({persist:false})
try{const env={...proxy.env,EMAIL_API_KEY:undefined,EMAIL_FROM:undefined,OPENAI_API_KEY:undefined,GITHUB_TOKEN:undefined,GITHUB_TOKENS:undefined},DB=env.DB;for(const file of ['0001_identity.sql','0002_conversations.sql','0003_identity_credentials.sql','0004_message_intent.sql','0005_widget_identity.sql','0007_conversation_history.sql','0070_management.sql','0071_management_preferences.sql','0080_integrations.sql','0100_inbound_email_claims.sql','0101_email_mailbox_lifecycle.sql','0102_public_abuse_limits.sql','0104_inbound_email_classification.sql','0050_knowledge.sql','0060_customer_context.sql','0060_customer_context_engine.sql','020_ai_support.sql'])for(const [,sql] of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await DB.prepare(sql).run();
await DB.batch([DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://widget.example',1)"),DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('q','Other','other','https://other.example',1)"),DB.prepare("INSERT INTO users VALUES('u','owner@example.com','Owner',1)"),DB.prepare("INSERT INTO memberships VALUES('p','u','owner')"),DB.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(await hashToken('token'),Date.now()+999999),DB.prepare("INSERT INTO contacts(id,project_id,name,email,created_at) VALUES('contact','p','Visitor','visitor@example.com',1)"),DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('c','p','contact',1,1)")]);
async function call(app,path,method='GET',body){const result=await app.request('https://app.example'+path,{method,headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},env);return result}
assert.equal((await call(routes,'/projects/q/settings')).status,403)
assert.equal((await call(routes,'/projects/p/settings','PUT',{name:'Renamed',timezone:'UTC',is_contact_tracking_enabled:true})).status,200)
const macro=await(await call(routes,'/projects/p/macros','POST',{title:'Welcome',content:'Hello'})).json();assert.ok(macro.data.id)
assert.equal((await call(routes,'/projects/q/macros/'+macro.data.id,'PUT',{title:'Stolen'})).status,403)
assert.equal((await call(routes,'/projects/p/agents/u','DELETE')).status,409,'last owner protected')
assert.equal((await call(routes,'/admin/users')).status,403,'project owner is not global administrator')
const bootstrap=await(await call(routes,'/bootstrap')).json();assert.equal(bootstrap.currentAgent.id,'u');assert.equal(bootstrap.projects.p.name,'Renamed');assert.equal(bootstrap.projects.q,undefined)
assert.equal((await call(dashboardRoutes,'/projects/q/conversations/c')).status,404)
assert.equal((await call(dashboardRoutes,'/projects/p/conversations/c/notes','POST',{content:'Private note'})).status,201)
assert.equal((await call(dashboardRoutes,'/projects/p/conversations/c/participants','POST',{email:'other@example.com'})).status,201)
assert.equal((await call(dashboardRoutes,'/projects/p/conversations/c/actions','POST',{action:'markAsRead'})).status,200)
const detail=await(await call(dashboardRoutes,'/projects/p/conversations/c')).json();assert.equal(detail.data.contact.display_name,'Visitor');assert.equal(detail.data.participants.length,1)
assert.equal((await call(routes,'/projects/p/email-settings/test','POST',{idempotencyKey:'test'})).status,503)
assert.equal((await publicWidget.request('https://app.example/settings?widgetKey=widget',{headers:{Origin:'https://other.example'}},env)).status,403)
const widget=await(await publicWidget.request('https://app.example/settings?widgetKey=widget',{headers:{Origin:'https://widget.example'}},env)).json();assert.equal(widget.currentAgent.name,'Owner');assert.equal(widget.collectorEnabled,true)
await DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('m','p','c','local','contact','contact','Hello',1,10)").run()
await DB.prepare("UPDATE conversations SET revision=1,last_message_id='m',assigned_to='u' WHERE id='c'").run()
const buckets=await(await call(dashboardRoutes,'/projects/p/conversations/c/buckets')).json();assert.equal(buckets.data[0].counts.contact_messages,1);assert.equal(buckets.data[0].messages.find(m=>m.id==='m').type,undefined);assert.equal(buckets.data[0].events[0].type,'INTERNAL_NOTE')
const mine=await(await call(dashboardRoutes,'/conversations?status=unresolved&assigned_to=myself')).json();assert.equal(mine.data.length,1)
const none=await(await call(dashboardRoutes,'/conversations?status=unresolved&assigned_to=none')).json();assert.equal(none.data.length,0)
await DB.prepare("INSERT INTO conversation_buckets VALUES('old-bucket','c',1,'{}')").run()
await DB.prepare("UPDATE messages SET bucket_id='old-bucket' WHERE id='m'").run()
const historical=await(await call(dashboardRoutes,'/projects/p/conversations/c/buckets/old-bucket')).json();assert.equal(historical.data.messages[0].id,'m');assert.equal(historical.data.id,'old-bucket')
assert.equal((await call(routes,'/projects/p/agents','POST',{email:'invite@example.com',role:'operator'})).status,201)
await DB.prepare("INSERT INTO sessions VALUES(?,'contact','p','contact','contact',?,NULL)").bind(await hashToken('contact-token'),Date.now()+999999).run()
const widgetContact=await widgetEvents.request('https://app.example/c/widget-events',{method:'POST',headers:{Authorization:'Bearer contact-token','Content-Type':'application/json'},body:JSON.stringify({action:'contact',data:{provided_name:'Updated',provided_email:'updated@example.com'}})},env);assert.equal(widgetContact.status,200)
assert.equal((await DB.prepare("SELECT name FROM contacts WHERE id='contact'").first()).name,'Updated')
assert.equal((await call(inboundEmail,'/email/inbound','POST',{messageId:'mail'})).status,403)
await call(routes,'/projects/p/email-settings','PUT',{from_name:'Support',from_address:'support@example.com',inbound_address:'inbound@example.com',is_enabled:true})
const input={messageId:'mail-1',from:'mail-contact@example.com',to:'inbound@example.com',text:'Help by email'}
async function email(){return inboundEmail.request('https://app.example/email/inbound',{method:'POST',headers:{Authorization:'Bearer inbound-token','Content-Type':'application/json'},body:JSON.stringify(input)},{...env,INBOUND_EMAIL_TOKEN:'inbound-token'})}
assert.equal((await email()).status,201);assert.equal((await email()).status,200)
assert.equal((await DB.prepare("SELECT count(*) n FROM messages WHERE content='Help by email'").first()).n,1)
await DB.batch([DB.prepare("UPDATE projects SET verification_secret='private-proof' WHERE id='p'"),DB.prepare("INSERT INTO users VALUES('op','op@example.com','Operator',1)"),DB.prepare("INSERT INTO memberships VALUES('p','op','operator')"),DB.prepare("INSERT INTO sessions VALUES(?,'op','p','operator',NULL,?,NULL)").bind(await hashToken('operator-token'),Date.now()+999999)])
for(const path of ['/bootstrap','/projects','/projects/p/settings','/projects/p/widget-settings']){const response=await routes.request('https://app.example'+path,{headers:{Authorization:'Bearer operator-token'}},env);assert.equal(response.status,200);assert.ok(!(await response.text()).includes('private-proof'),path+' must not expose verification secret')}
const ownerSettings=await(await call(routes,'/projects/p/widget-settings')).json();assert.equal(ownerSettings.verificationSecret,'private-proof')
await DB.prepare("INSERT INTO memberships VALUES('q','u','owner')").run()
await DB.prepare("INSERT INTO sessions VALUES(?,'u','q','owner',NULL,?,NULL)").bind(await hashToken('q-token'),Date.now()+999999).run()
async function callQ(path,method='GET',body){return routes.request('https://app.example'+path,{method,headers:{Authorization:'Bearer q-token','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},env)}
assert.equal((await callQ('/projects/q/email-settings','PUT',{from_name:'Other Support',from_address:'other@example.com',inbound_address:'INBOUND@example.com',is_enabled:true})).status,409,'case-insensitive active mailbox conflict is explicit')
const liveSettings=(await DB.prepare("SELECT settings_json FROM project_settings WHERE project_id='p'").first()).settings_json
await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.deleted_at',123),updated_at=123 WHERE project_id='p'").run()
await assert.rejects(
 updateEmailSettings(DB,{projectId:'p',fromName:'Stale',fromAddress:'stale@example.com',inboundAddress:'stale@example.com',enabled:true,updatedAt:124}),
 error=>error?.status===409,
 'a mailbox write that reaches the database after deletion must be rejected'
)
const staleWrite=await DB.prepare("SELECT from_address,inbound_address,is_enabled FROM email_settings WHERE project_id='p'").first()
assert.equal(staleWrite.from_address,'support@example.com');assert.equal(staleWrite.inbound_address,'inbound@example.com');assert.equal(staleWrite.is_enabled,1)
await DB.prepare("UPDATE project_settings SET settings_json=?,updated_at=1 WHERE project_id='p'").bind(liveSettings).run()
assert.equal((await call(routes,'/projects/p','DELETE')).status,200,'project deletion releases mailbox ownership')
const archivedEmail=await DB.prepare("SELECT inbound_address,is_enabled FROM email_settings WHERE project_id='p'").first();assert.equal(archivedEmail.inbound_address,null);assert.equal(archivedEmail.is_enabled,0)
const archivedSettings=JSON.parse((await DB.prepare("SELECT settings_json FROM project_settings WHERE project_id='p'").first()).settings_json);assert.equal(archivedSettings.retired_inbound_address,'inbound@example.com','deleted mailbox remains in project history')
assert.equal((await callQ('/projects/q/email-settings','PUT',{from_name:'Other Support',from_address:'other@example.com',inbound_address:'Support <Inbound@example.com>',is_enabled:true})).status,200,'display-form mailbox is accepted after release')
const reclaimed=await DB.prepare("SELECT inbound_address,is_enabled FROM email_settings WHERE project_id='q'").first();assert.equal(reclaimed.inbound_address,'inbound@example.com');assert.equal(reclaimed.is_enabled,1)
console.log('Management D1: scoped settings/resources/bootstrap, last-owner and global-admin boundaries, dashboard notes/contact participants, provider missing config and widget origin checks passed')
}finally{await proxy.dispose()}
