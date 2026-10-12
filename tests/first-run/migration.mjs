import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);

test('the Base outbox schema is byte-identical and preserves populated native prior data',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const schema=await readFile(new URL('migrations/117_development_outbox.sql',root),'utf8');
  assert.equal(schema,await readFile(new URL('src/vendor/base/modules/mail/src/development/schema.sql',root),'utf8'));
  const files=(await readdir(new URL('migrations/',root))).filter(name=>name.endsWith('.sql')&&parseInt(name,10)<117).sort();
  for(const file of files)db.exec(await readFile(new URL('migrations/'+file,root),'utf8'));
  const digest=()=>createHash('sha256').update(randomBytes(32)).digest('hex');
  db.exec("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('prior-project','Prior workspace','public-widget-key','https://example.test',1);INSERT INTO users VALUES('prior-owner','owner@example.test','Prior owner',1);INSERT INTO memberships VALUES('prior-project','prior-owner','owner');");
  db.prepare('INSERT INTO credentials VALUES(?,?,?)').run('prior-owner',digest(),2);
  db.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,?,?,?,?)').run(digest(),'prior-owner','prior-project','owner',Date.now()+60000);
  db.prepare('INSERT INTO magic_signins VALUES(?,?,?,?,?,NULL)').run(digest(),'prior-owner','prior-project','owner@example.test',Date.now()+60000);
  db.exec("INSERT INTO contacts(id,project_id,name,email,created_at) VALUES('prior-contact','prior-project','Prior contact','contact@example.test',3);INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES('prior-conversation','prior-project','prior-contact',3,3);");
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
  const dump=()=>Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]));
  const before=dump();db.exec(schema);assert.ok(JSON.stringify(dump())===JSON.stringify(before),'every prior native row and credential is byte-preserved');
  assert.equal(db.prepare('SELECT count(*) n FROM rer_mail_development_outbox').get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n,tables.length+1);
 }finally{db.close();}
});
