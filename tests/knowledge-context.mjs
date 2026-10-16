import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync,mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const temp=mkdtempSync(join(tmpdir(),'h2h-knowledge-'))
try {
 execFileSync('node_modules/.bin/esbuild',['src/modules/customer-context/evidence.ts','src/modules/knowledge/providers.ts','src/modules/knowledge/service.ts','--bundle','--platform=node','--format=esm',`--outdir=${temp}`],{stdio:'pipe'})
 const evidence=await import(join(temp,'customer-context/evidence.js'))
 const providers=await import(join(temp,'knowledge/providers.js'))
 const service=await import(join(temp,'knowledge/service.js'))
 assert.equal(providers.chunks('a'.repeat(2500)).length,3)
 assert.throws(()=>service.validateDocuments([{url:'javascript:alert(1)',title:'x',content:'x'}]))
 assert.equal(evidence.eligibleEvidence([{id:'idle',source:'customer_activity',content:'Detected extended inactivity (120 seconds without interaction) - User may be hesitating.',visibility:'private',occurred_at:1}]).length,0)
 const fields=Object.fromEntries(evidence.PROFILE_KEYS.contact.map(k=>[k,{value:null,evidence_status:'unknown',evidence_ids:[]}]))
 assert(evidence.validateProfile('contact',fields,[]));fields.role={value:'CEO',confidence:90,evidence_status:'supported',evidence_ids:['invented']};assert(!evidence.validateProfile('contact',fields,[]))
 assert.deepEqual(evidence.publicSignals({personality:{value:'concise',confidence:90,evidence_status:'supported',evidence_ids:['1']}},false),[])
 assert.equal(evidence.cooldown('contact',3),6000000)
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync('migrations/0001_identity.sql','utf8'));db.exec(readFileSync('migrations/0070_management.sql','utf8'));db.exec("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://example.com',0),('other','Other','other-widget','https://other.example.com',0)");db.exec(readFileSync('migrations/0050_knowledge.sql','utf8'));db.exec(readFileSync('migrations/0060_customer_context.sql','utf8'));for(const file of ['0002_conversations.sql','123_operator_notifications.sql','0004_message_intent.sql','0060_customer_context_engine.sql','020_ai_support.sql','0051_knowledge_authoring.sql','0105_edition_delegation.sql','0108_public_answer_citations.sql'])db.exec(readFileSync('migrations/'+file,'utf8'))
 db.exec("INSERT INTO knowledge_datasets(id,project_id,name,created_at) VALUES('a','p','A',1); INSERT INTO knowledge_versions(id,dataset_id,fingerprint,created_at) VALUES('v1','a','hash',1); INSERT INTO knowledge_documents(id,version_id,url,title,content) VALUES('d1','v1','https://example.com','Title','Published'); UPDATE knowledge_datasets SET published_version='v1',status='ready' WHERE id='a'")
 const claim=db.prepare("UPDATE knowledge_datasets SET claim_token=?,status='ingesting' WHERE id='a' AND project_id='p' AND claim_token IS NULL")
 assert.equal(claim.run('one').changes,1);assert.equal(claim.run('two').changes,0)
 db.exec("UPDATE knowledge_datasets SET status='failed',claim_token=NULL WHERE id='a' AND claim_token='one'")
 assert.equal(db.prepare('SELECT content FROM knowledge_documents f JOIN knowledge_datasets d ON d.published_version=f.version_id WHERE d.project_id=?').get('p').content,'Published')
 assert.equal(db.prepare('SELECT content FROM knowledge_documents f JOIN knowledge_datasets d ON d.published_version=f.version_id WHERE d.project_id=?').get('other'),undefined)
 assert.equal(db.prepare("UPDATE knowledge_datasets SET published_version='stale' WHERE id='a' AND claim_token='one'").run().changes,0)
 const storage=new Map();const queue=[];
 const env={DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes}}},sql,args}}}},async batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>({meta:{changes:db.prepare(s.sql).run(...s.args).changes}}));db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}},FILES:{async put(key,value){storage.set(key,value)},async get(key){return storage.has(key)?{async json(){return JSON.parse(storage.get(key))}}:null}},JOBS:{async send(job){queue.push(job)}}};
 await service.refreshDataset(env,'p','a',{documents:[{url:'https://example.com/new',title:'Fresh',content:'New corpus contents'}]});
 while(queue.length)await service.consumeJob(queue.shift(),env);
 assert.equal((await service.searchKnowledge(env,'p','corpus'))[0].title,'Fresh');
 await service.refreshDataset(env,'p','a',{documents:[]});while(queue.length)await service.consumeJob(queue.shift(),env);
 assert.equal((await service.searchKnowledge(env,'p','corpus'))[0].title,'Fresh');
 assert.equal(db.prepare("SELECT status FROM knowledge_datasets WHERE id='a'").get().status,'failed');
 db.close();console.log('Knowledge/context: 15 assertions passed (real SQLite persistence, native pure contracts; provider calls not exercised).')
} finally {rmSync(temp,{recursive:true,force:true})}
