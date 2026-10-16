import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile,readdir} from 'node:fs/promises'
import {startApp,sha} from '../../journeys/kit/app.mjs'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const {INBOX_SEARCH_MAX_LENGTH}=await import('../../../src/modules/management/inbox-search.ts')

// Inbox search through the dashboard route: literal wildcards, name, email and supplied identity, all-history
// phrases and words from an index built after the history existed and kept by every write, independent status,
// assignment and AI views, workspace isolation, and bounded terms that answer 200 or a friendly 400.
export async function inboxSearchJourney(){
 const app=await startApp({migrate:false}),DB=app.db,hashToken=async value=>sha(value)
 const directory=new URL('../../../migrations/',import.meta.url),files=(await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()
 const migrate=async select=>{for(const name of files.filter(select)){const source=(await readFile(new URL(name,directory),'utf8')).replace(/^\s*--[^\n]*$/gm,'');await DB.batch([...source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g)].map(match=>match[1]).filter(sql=>sql.trim()!==';').map(sql=>DB.prepare(sql)))}}
 try{
  // Every migration except the message index: the index arrives after history already exists.
  await migrate(name=>name!=='123_inbox_message_search.sql')
 const contacts=[['plain','Alice Archer','alice@archer.example'],['pct','100% Pat','pat@percent.example'],['under','snake_case Sam','sam@under.example'],['slash','Back\\slash Bea','bea@slash.example'],['accent','Zoë Ünal','zoe@accent.example'],['upper','CHARLIE UPPER','Charlie.Mixed@Case.example']]
 await DB.batch([
  DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://widget.example',1)"),
  DB.prepare("INSERT INTO users VALUES('u','owner@example.com','Owner',1)"),DB.prepare("INSERT INTO memberships VALUES('p','u','owner')"),
  DB.prepare("INSERT INTO sessions VALUES(?,'u','p','owner',NULL,?,NULL)").bind(await hashToken('token'),Date.now()+999999),
  ...contacts.flatMap(([id,name,email],index)=>[DB.prepare('INSERT INTO contacts(id,project_id,name,email,created_at) VALUES(?,?,?,?,?)').bind(id,'p',name,email,1),DB.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind('c-'+id,'p',id,1,10+index),...(id==='plain'?[]:[DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES(?,'p',?,'first',?,'contact','Opening question',1,1)").bind('m-'+id,'c-'+id,id)])]),
 ])
 // A closed, assigned retained thread predates the index migration.
 await DB.batch([
  DB.prepare("UPDATE contacts SET metadata_json=? WHERE id='plain'").bind(JSON.stringify({provided_name:'Alicia Warehouse',provided_email:'returns@supplied.example'})),
  DB.prepare("UPDATE conversations SET resolved_at=500,assigned_to='u' WHERE id='c-plain'"),
  DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('history','p','c-plain','history','plain','contact','The cobalt buckle replacement arrived safely; the refund for my last invoice is pending',1,100)"),
 ])
 await migrate(name=>name==='123_inbox_message_search.sql')
 // Derived full-text/shadow storage is not business archive state.
 const {catalogue,policy}=await import('@runeditrun/rer/internal/modules/portability/catalogue.mjs')
 const {archivePolicy}=await import('../../../scripts/installer/portability-policy.mjs')
 const catalog=await catalogue(DB,policy({product:archivePolicy.product,derivedTables:archivePolicy.derivedTables}))
 assert.ok(catalog.tables.some(table=>table.name==='messages'),'transcripts remain archived')
 assert.ok(!catalog.tables.some(table=>table.name.startsWith('inbox_message_search')),'the message index is rebuilt, not archived')
 const list=async(params)=>app.request('/api/dashboard/projects/p/conversations?'+new URLSearchParams({view:'open',...params}),{token:'token'})
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
 await DB.batch([DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('later','p','c-plain','later','u','owner','Thanks, closing this now',2,200)"),DB.prepare("UPDATE conversations SET last_message_id='later' WHERE id='c-plain'")])
 const [found]=(await(await list({q:'cobalt buckle replacement'})).json()).data
 assert.deepEqual([found.last_message.content,found.matched_message.content.slice(0,10)],['Thanks, closing this now','The cobalt'],'a result previews the message that matched')
 // All unquoted words are required in any order; explicit phrases stay adjacent.
 for(const q of ['refund invoice','invoice refund','refund "last invoice"','"last invoice" refund'])assert.deepEqual(await names({q}),['Alice Archer'],q)
 for(const q of ['"refund invoice"','refund "invoice last"','refund missing'])assert.deepEqual(await names({q}),[],q)
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
 // A missing index entry is a failure even when all message rows survive.
 const integrity="INSERT INTO inbox_message_search(inbox_message_search,rank) VALUES('integrity-check',1)"
 await DB.prepare("DELETE FROM inbox_message_search WHERE rowid=(SELECT rowid FROM messages WHERE id='history')").run()
 await assert.rejects(()=>DB.prepare(integrity).run(),'content integrity refuses a missing indexed message')
 await DB.prepare("INSERT INTO inbox_message_search(inbox_message_search) VALUES('rebuild')").run()
 await DB.prepare(integrity).run()
 assert.deepEqual(await names({q:'cobalt buckle replacement'}),['Alice Archer'],'reconstructed content is searchable')
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
  DB.prepare("INSERT INTO messages(id,project_id,conversation_id,local_id,actor_id,actor_role,content,revision,created_at) VALUES('foreign-message','foreign','foreign-thread','history','other','contact','cobalt buckle replacement; the refund for my last invoice',1,100)")
 ])
 assert.deepEqual(await names({q:'cobalt buckle replacement'}),[],'indexed phrases never cross workspace authority')
 assert.deepEqual(await names({q:'refund invoice'}),[],'indexed words never cross workspace authority')
 // Any term length is a 200 or a friendly 400; nothing reaches the database as an error.
 assert.equal((await names({q:'a'.repeat(INBOX_SEARCH_MAX_LENGTH)})).length,0,'the longest allowed term still searches')
 for(const length of [49,50,51,200+1,400,6000]){
  const response=await list({q:'a'.repeat(length)})
  if(length<=INBOX_SEARCH_MAX_LENGTH)assert.equal(response.status,200,`${length} characters`)
  else{assert.equal(response.status,400,`${length} characters`);const message=await response.text();assert.match(message,/too long/i);assert.match(message,new RegExp(String(INBOX_SEARCH_MAX_LENGTH)));assert.doesNotMatch(message,/diagnostics/i)}
 }
 for(const term of ["'",'"','\u0000','日本語のテスト'.repeat(20),'a b c '.repeat(30),'%25','?*[]()','x'.repeat(INBOX_SEARCH_MAX_LENGTH-1)+'%'])assert.deepEqual(await names({q:term}),[],`term ${JSON.stringify(term.slice(0,12))}`)
 }finally{await app.close()}
}
