import assert from 'node:assert/strict'
import {startApp} from '../../journeys/kit/app.mjs'

/**
 * ACCESS-001 (roles) and AUDIT-001 through the public doors: a collaborator adds notes
 * and follows but cannot reply, assign, erase or export; a restricted custom role
 * loses publication and export; role changes need a recent step-up; every mutating
 * door is classified; the security log refuses edits, honours retention and holds.
 */
export async function rolesAuditJourney(){
 const app=await startApp({bindings:{H2H_LOCAL:'true',EMAIL_PROVIDER:'development',EMAIL_FROM:'support@localhost.test'}})
 try{
  assert.deepEqual((await app.call('/_test/unclassified-routes')).data,[],'every mutating door has a role rule')
  const call=(path,body,token,method)=>app.call(path,{body,token,method})
  const w=await app.seedWorkspace('roles'),P=`/api/management/projects/${w.projectId}`,C=`/api/dashboard/projects/${w.projectId}/conversations/conv-r`
  await app.db.batch([
   app.db.prepare("INSERT INTO contacts(id,project_id,name,email,created_at) VALUES('ct-r',?,'Riley Customer','riley@example.com',1)").bind(w.projectId),
   app.db.prepare("INSERT INTO conversations(id,project_id,contact_id,revision,last_message_id,created_at,updated_at) VALUES('conv-r',?,'ct-r',1,'m-r',2,2)").bind(w.projectId),
   app.db.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at,intent_hash) VALUES('m-r',?,'conv-r','c-r','ct-r','contact','Where is my order?',1,2,'hash-r')").bind(w.projectId),
  ])
  // The owner invites a collaborator, who accepts with a password and signs in.
  const invited=await call(`${P}/agents`,{email:'collab@example.com',role:'collaborator'},w.tokens.owner);assert.equal(invited.status,201)
  const token=new URL(invited.data.data.invitationUrl).searchParams.get('token')
  assert.equal((await call('/api/identity/accept-token',{token,name:'Casey Collaborator',password:'collab-correct-horse-battery'})).status,200)
  const collaborator=(await call('/api/identity/login',{email:'collab@example.com',password:'collab-correct-horse-battery'})).data
  const bootstrap=(await call(`/api/management/bootstrap?projectId=${w.projectId}`,undefined,collaborator.token)).data
  assert.equal(bootstrap.projects[w.projectId].access.name,'Collaborator');assert.deepEqual(bootstrap.projects[w.projectId].access.permissions,['conversations.notes','conversations.follow'])
  assert.equal((await call(`${P}/agents`,undefined,w.tokens.owner)).data.data.find(row=>row.email==='collab@example.com').access_name,'Collaborator')

  // A collaborator views the ticket, adds a note, follows and reads; everything else is refused and audited.
  assert.equal((await call(C,undefined,collaborator.token)).status,200)
  assert.equal((await call(`${C}/notes`,{content:'Customer is on the beta plan'},collaborator.token)).status,201)
  const followed=await call(`${C}/follow`,{},collaborator.token);assert.equal(followed.status,200);assert.deepEqual(followed.data.data.followers.map(row=>row.name),['Casey Collaborator'])
  assert.equal((await call(`${C}/actions`,{action:'markAsRead',data:{ids:['m-r']}},collaborator.token)).status,200)
  const reply=await call('/api/conversations/conv-r/messages',{content:'Public reply',localId:'collab-1',expectedRevision:1,expectedLastMessageId:'m-r'},collaborator.token)
  assert.equal(reply.status,403);assert.equal(reply.data.code,'permission_denied');assert.equal(reply.data.permission,'conversations.reply')
  for(const [path,body,method] of [[C,{assigned_to:collaborator.actor.id},'PUT'],[`${C}/tags`,{tagId:'vip'},'POST'],[`${P}/contacts/ct-r/erase`,{},'POST'],[`/api/knowledge/${w.projectId}/articles`,{title:'x',content:'y'},'POST']]){
   const refused=await call(path,body,collaborator.token,method);assert.equal(refused.status,403,path);assert.equal(refused.data.code,'permission_denied',path)
  }
  assert.equal((await call(`${P}/audit/export`,undefined,collaborator.token)).status,403)
  assert.equal((await app.first("SELECT count(*) n FROM messages WHERE conversation_id='conv-r'")).n,1,'no public reply was admitted')
  assert.ok((await app.first("SELECT count(*) n FROM audit_events WHERE action='permission.denied' AND actor_id=?",collaborator.actor.id)).n>=5)
  assert.equal((await call(`${P}/agents`,undefined,w.tokens.owner)).data.data.some(row=>row.id===collaborator.actor.id&&row.role==='operator'),true,'the collaborator joins on the agent base')

  // A custom role over Agent without publishing or exporting: the agent keeps replying but cannot publish.
  const created=await call(`${P}/roles`,{name:'Support, no publishing',base:'operator',permissions:['conversations.reply','conversations.notes','conversations.follow','conversations.manage','contacts.manage','knowledge.edit','reports.view','members.manage']},w.tokens.owner)
  assert.equal(created.status,201);assert.ok(!created.data.data.permissions.includes('members.manage'),'a custom role never exceeds its base')
  await app.db.prepare('UPDATE session_factors SET verified_at=verified_at-? WHERE token_hash IN (SELECT token_hash FROM sessions WHERE actor_id=?)').bind(20*60*1000,w.users.owner).run()
  const stale=await call(`${P}/agents/${w.users.operator}`,{role:created.data.data.id},w.tokens.owner,'PUT');assert.equal(stale.status,403);assert.equal(stale.data.code,'step_up_required')
  await app.db.prepare("INSERT INTO credentials(user_id,password_hash,updated_at) VALUES(?,?,1)").bind(w.users.owner,(await app.first('SELECT password_hash FROM credentials WHERE user_id=?',collaborator.actor.id)).password_hash).run()
  assert.equal((await call('/api/identity/step-up',{password:'collab-correct-horse-battery'},w.tokens.owner)).status,200,'an account without a factor steps up with its password')
  assert.equal((await call(`${P}/agents/${w.users.operator}`,{role:created.data.data.id},w.tokens.owner,'PUT')).status,200)
  const publish=await call(`/api/knowledge/${w.projectId}/articles`,{title:'Returns',content:'How returns work'},w.tokens.operator);assert.equal(publish.status,403);assert.equal(publish.data.permission,'knowledge.publish')
  assert.equal((await call(`/api/dashboard/projects/${w.projectId}/reports?period=30&format=summary.csv`,undefined,w.tokens.operator)).data.permission,'data.export')
  assert.equal((await call('/api/conversations/conv-r/messages',{content:'We are on it',localId:'agent-1',expectedRevision:1,expectedLastMessageId:'m-r',authoring:{kind:'human'}},w.tokens.operator)).status,200,'the custom role still replies')
  const changed=await app.first("SELECT detail_json FROM audit_events WHERE action='member.role_changed' AND target_id=?",w.users.operator)
  assert.deepEqual(JSON.parse(changed.detail_json),{from:'operator',to:created.data.data.id,fromName:'Agent',toName:'Support, no publishing'})
  assert.equal((await call(`${P}/roles/${created.data.data.id}`,undefined,w.tokens.owner,'DELETE')).status,409,'a role in use stays')

  // The security log is append-only, kept for its retention except under a legal hold.
  await assert.rejects(app.db.prepare('UPDATE audit_events SET outcome=?').bind('failed').run(),/audit_append_only/)
  await assert.rejects(app.db.prepare('DELETE FROM audit_events').run(),/audit_retained/)
  const day=86400000,now=Date.now()
  await app.db.batch([400,380,200].map((age,i)=>app.db.prepare("INSERT INTO audit_events(id,project_id,at,category,action,outcome,actor_type,actor_id,source) VALUES(?,?,?,'auth','sign_in.succeeded','succeeded','user',?,'dashboard')").bind('old-'+i,w.projectId,now-age*day,w.users.admin)))
  assert.equal((await call(`${P}/audit/retention`,{days:30},w.tokens.owner,'PUT')).status,400)
  assert.equal((await call(`${P}/audit/retention`,{days:365},w.tokens.admin,'PUT')).status,403,'only an owner sets retention')
  assert.equal((await call(`${P}/audit/retention`,{days:365},w.tokens.owner,'PUT')).status,200)
  const hold=await call(`${P}/audit/holds`,{name:'Chargeback dispute',reason:'Evidence for a card dispute',starts_at:new Date(now-390*day).toISOString(),ends_at:new Date(now-370*day).toISOString()},w.tokens.owner);assert.equal(hold.status,201)
  await app.scheduled()
  assert.deepEqual((await app.sql("SELECT id FROM audit_events WHERE id LIKE 'old-%' ORDER BY id")).map(row=>row.id),['old-1','old-2'],'the expired entry outside the hold is removed, the held one stays')
  const purged=JSON.parse((await app.first("SELECT detail_json FROM audit_events WHERE action='audit.purged'")).detail_json);assert.deepEqual(purged,{removed:1,keptUnderHold:1,olderThanDays:365})
  const page=(await call(`${P}/audit?category=auth`,undefined,w.tokens.admin)).data
  assert.ok(page.data.find(row=>row.id==='old-1').held);assert.equal(page.holds.length,1);assert.equal(page.retentionDays,365)
  assert.ok(page.data.every(row=>row.category==='auth'))
  assert.equal((await call(`${P}/audit/holds/${hold.data.data.id}/release`,{},w.tokens.owner)).status,200)
  assert.equal((await call(`${P}/audit`,undefined,w.tokens.operator)).status,403,'agents do not read the security log')
 }finally{await app.close()}
}
