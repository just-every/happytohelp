import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {findDatabase} from '../helpers/upgrade-snapshot.mjs';
import assert from 'node:assert/strict';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Observe the real persisted Worker state, exposing only digests in test errors.
export async function profileEffects(runtime,contactId,email){
 const database=await findDatabase(join(runtime.directory,'state/v3/d1'));
 const db=new DatabaseSync(database,{readOnly:true});
 try{
  const contact=db.prepare('SELECT * FROM contacts WHERE id=?').get(contactId);
  assert.equal(contact?.email===email,true,'the real saved contact retains the expected email');
  const result={contact:digest(contact),authorityEpoch:digest(db.prepare('SELECT * FROM integration_authority_epoch').all())};
  for(const name of ['email_deliveries','rer_mail_development_outbox','ai_generations','native_integration_events','native_integration_intents']){
   const rows=db.prepare('SELECT * FROM '+name).all().map(row=>JSON.stringify(row)).sort();result[name]={count:rows.length,digest:digest(rows)};
  }
  return result;
 }finally{db.close();}
}
