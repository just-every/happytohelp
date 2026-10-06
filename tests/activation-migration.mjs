import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFile,readdir} from 'node:fs/promises'
const directory=new URL('../migrations/',import.meta.url),names=(await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()
const activation=names.find(name=>name.endsWith('_activation_receipts.sql'))
const source=await readFile(new URL(activation,directory),'utf8')
for(const shape of ['fresh','prior-release'])test(`activation migration preserves ${shape} rows without fabricating validations`,async()=>{
 const db=new DatabaseSync(':memory:')
 try {
  for(const name of names.filter(name=>name!==activation))db.exec(await readFile(new URL(name,directory),'utf8'))
  if(shape==='prior-release')db.exec(`INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Existing','key','https://old.example',1);
   INSERT INTO email_settings VALUES('p','Support','support@example.test','inbound@example.test',1,2);
   INSERT INTO inbound_emails(id,project_id,intent_hash,state,created_at,message_id) VALUES('old','p','old','delivered',3,'old-message');`)
  const projects=db.prepare('SELECT * FROM projects').all(),inbound=db.prepare('SELECT * FROM inbound_emails').all()
  db.exec(source)
  assert.deepEqual(db.prepare('SELECT * FROM projects').all(),projects);assert.deepEqual(db.prepare('SELECT * FROM inbound_emails').all(),inbound)
  for(const table of ['activation_receipts','activation_widget_pings','activation_inbound_receipts'])assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0)
  if(shape==='prior-release') {
   db.exec("INSERT INTO inbound_emails(id,project_id,intent_hash,state,created_at) VALUES('new','p','new','processing',4)")
   assert.equal(db.prepare('SELECT address FROM activation_inbound_receipts').get().address,'inbound@example.test')
   db.exec("INSERT INTO activation_widget_pings VALUES('p','https://old.example',5,'ping'); UPDATE projects SET allowed_origin='https://new.example' WHERE id='p'")
   assert.equal(db.prepare('SELECT count(*) n FROM activation_widget_pings').get().n,0)
  }
 }finally{db.close()}
})
