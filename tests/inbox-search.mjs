// Inbox search contract: literal matching, a bounded term, and no database error for any term (module level, local D1).
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const {dashboardRoutes}=await import('../src/modules/management/index.ts')
const {INBOX_SEARCH_MAX_LENGTH,inboxSearchTerm}=await import('../src/modules/management/inbox-search.ts')
const {hashToken}=await import('../src/platform/auth.ts')
const {getPlatformProxy}=await import('wrangler')
const proxy=await getPlatformProxy({persist:false})
try{
 const env={...proxy.env},DB=env.DB
 for(const file of ['0001_identity.sql','0002_conversations.sql','0003_identity_credentials.sql','0004_message_intent.sql','0005_widget_identity.sql','0007_conversation_history.sql','0070_management.sql','0071_management_preferences.sql','0080_integrations.sql','0050_knowledge.sql','0060_customer_context.sql','0060_customer_context_engine.sql','020_ai_support.sql','0110_move_in.sql','112_conversation_outcomes.sql'])for(const [,sql] of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await DB.prepare(sql).run()
 const contacts=[['plain','Alice Archer','alice@archer.example'],['pct','100% Pat','pat@percent.example'],['under','snake_case Sam','sam@under.example'],['slash','Back\\slash Bea','bea@slash.example'],['accent','Zoë Ünal','zoe@accent.example'],['upper','CHARLIE UPPER','Charlie.Mixed@Case.example']]
 await DB.batch([
  DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://widget.example',1)"),
  DB.prepare("INSERT INTO users VALUES('u','owner@example.com','Owner',1)"),DB.prepare("INSERT INTO memberships VALUES('p','u','owner')"),
  DB.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(await hashToken('token'),Date.now()+999999),
  ...contacts.flatMap(([id,name,email],index)=>[DB.prepare('INSERT INTO contacts(id,project_id,name,email,created_at) VALUES(?,?,?,?,?)').bind(id,'p',name,email,1),DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind('c-'+id,'p',id,1,10+index)]),
 ])
 // A closed, assigned retained thread predates the index migration.
 await DB.batch([
  DB.prepare("UPDATE contacts SET metadata_json=? WHERE id='plain'").bind(JSON.stringify({provided_name:'Alicia Warehouse',provided_email:'returns@supplied.example'})),
  DB.prepare("UPDATE conversations SET resolved_at=500,assigned_to='u' WHERE id='c-plain'"),
  DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('history','p','c-plain','history','plain','contact','The cobalt buckle replacement arrived safely',1,100)"),
 ])
 for(const [,sql] of (await readFile(new URL('../migrations/123_inbox_message_search.sql',import.meta.url),'utf8')).matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await DB.prepare(sql).run()
 // Derived full-text/shadow storage is not business archive state.
 const {catalogue,policy}=await import('@runeditrun/rer/internal/modules/portability/catalogue.mjs')
 const {archivePolicy}=await import('../scripts/installer/portability-policy.mjs')
 const catalog=await catalogue(DB,policy({product:archivePolicy.product,derivedTables:archivePolicy.derivedTables}))
 assert.ok(catalog.tables.some(table=>table.name==='messages'),'transcripts remain archived')
 assert.ok(!catalog.tables.some(table=>table.name.startsWith('inbox_message_search')),'the message index is rebuilt, not archived')
 const list=async(params)=>dashboardRoutes.request('https://app.example/projects/p/conversations?'+new URLSearchParams({view:'open',...params}),{headers:{Authorization:'Bearer token'}},env)
 const names=async(params)=>{const response=await list(params);assert.equal(response.status,200,`${JSON.stringify(params).slice(0,80)} -> ${response.status}`);return (await response.json()).data.map(row=>row.contact.name).sort()}

 // Wildcards are literal.
 assert.deepEqual(await names({q:'%'}),['100% Pat'],'% matches only a literal percent sign')
 assert.deepEqual(await names({q:'_'}),['snake_case Sam'],'_ matches only a literal underscore')
 assert.deepEqual(await names({q:'%%'}),[],'%% is not a wildcard')
 assert.deepEqual(await names({q:'%_%'}),[],'%_% is not a wildcard')
 assert.deepEqual(await names({q:'\\'}),['Back\\slash Bea'],'a backslash matches only itself')
 assert.deepEqual(await names({q:'_case'}),['snake_case Sam'])
 assert.deepEqual(await names({q:'100%'}),['100% Pat'])
 assert.deepEqual(await names({search:'%'}),['100% Pat'],'the search alias is literal too')

 // Ordinary search still works: name or email, any ASCII case, whitespace trimmed.
 assert.deepEqual(await names({q:'alice'}),['Alice Archer'])
 assert.deepEqual(await names({q:'  ALICE@archer.EXAMPLE '}),['Alice Archer'])
 assert.deepEqual(await names({q:'charlie.mixed@case'}),['CHARLIE UPPER'])
 assert.deepEqual(await names({q:'Zoë'}),['Zoë Ünal'],'a non-ASCII term matches itself')
 assert.deepEqual(await names({q:'nobody'}),[])
 assert.ok(!(await names({})).includes('Alice Archer'),'open omits the closed thread')
 assert.deepEqual(await names({q:'   '}),await names({}),'a blank term is no term')

 // Indexed history, supplied identity and independent status/assignment filters.
 assert.deepEqual(await names({q:'cobalt buckle replacement'}),['Alice Archer'],'all-history search finds a retained closed thread from Open')
 assert.deepEqual(await names({q:'Alicia Warehouse'}),['Alice Archer'])
 assert.deepEqual(await names({q:'returns@supplied.example'}),['Alice Archer'])
 assert.deepEqual(await names({q:'cobalt buckle replacement',search_scope:'view'}),[])
 assert.deepEqual(await names({q:'cobalt buckle replacement',search_scope:'view',status:'resolved',assigned_to:'myself'}),['Alice Archer'])
 assert.deepEqual(await names({status:'resolved',assigned_to:'none'}),[])
 assert.deepEqual(await names({status:'resolved',assigned_to:'myself'}),['Alice Archer'])
 await DB.prepare("INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES('ai','p','Assistant','assistant','Help','test',1)").run()
 await DB.prepare("INSERT INTO conversation_ai VALUES('c-pct','ai'),('c-plain','ai')").run()
 assert.ok(!(await names({})).includes('100% Pat'),'human Open excludes AI')
 assert.deepEqual(await names({view:'ai',assigned_to:'myself'}),['Alice Archer'],'AI includes closed history and composes with assignment')
 assert.deepEqual(await names({view:'closed'}),[],'human Closed excludes AI')
 // The same triggers cover normal commits, import, erasure and undo.
 await DB.prepare("UPDATE messages SET content='A different retained answer' WHERE id='history'").run()
 assert.deepEqual(await names({q:'cobalt buckle replacement'}),[],'replaced/erased words leave the index')
 assert.deepEqual(await names({q:'different retained answer'}),['Alice Archer'])
 await DB.prepare("DELETE FROM messages WHERE id='history'").run()
 assert.deepEqual(await names({q:'different retained answer'}),[],'removed imported history leaves the index')
 await DB.batch([
  DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('foreign','Other workspace','foreign','https://other.example',1)"),
  DB.prepare("INSERT INTO contacts(id,project_id,name,created_at) VALUES('other','foreign','Other customer',1)"),
  DB.prepare("INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('foreign-thread','foreign','other',1,1)"),
  DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('foreign-message','foreign','foreign-thread','history','other','contact','cobalt buckle replacement',1,100)")
 ])
 assert.deepEqual(await names({q:'cobalt buckle replacement'}),[],'indexed phrases never cross workspace authority')
 // Any term length is a 200 or a friendly 400; nothing reaches the database as an error.
 assert.equal((await names({q:'a'.repeat(INBOX_SEARCH_MAX_LENGTH)})).length,0,'the longest allowed term still searches')
 for(const length of [49,50,51,200+1,400,6000]){
  const response=await list({q:'a'.repeat(length)})
  if(length<=INBOX_SEARCH_MAX_LENGTH)assert.equal(response.status,200,`${length} characters`)
  else{assert.equal(response.status,400,`${length} characters`);const message=await response.text();assert.match(message,/too long/i);assert.match(message,new RegExp(String(INBOX_SEARCH_MAX_LENGTH)));assert.doesNotMatch(message,/diagnostics/i)}
 }
 for(const term of ["'",'"','\u0000','日本語のテスト'.repeat(20),'a b c '.repeat(30),'%25','?*[]()','x'.repeat(INBOX_SEARCH_MAX_LENGTH-1)+'%'])assert.deepEqual(await names({q:term}),[],`term ${JSON.stringify(term.slice(0,12))}`)
 assert.throws(()=>inboxSearchTerm({req:{query:name=>name==='search'?'z'.repeat(INBOX_SEARCH_MAX_LENGTH+1):undefined}}),error=>error.status===400)
 console.log('Inbox search: literal % _ and backslash, name/email matching, bounded terms with a friendly 400 and no database errors passed')
}finally{await proxy.dispose()}
