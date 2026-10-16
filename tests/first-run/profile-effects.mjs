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
  // Reconnecting sends an authenticated installation ping even with optional
  // activity collection disabled. Compare its timestamp separately, preserving
  // exact equality for every saved profile field and all other metadata.
  const {last_seen_at:lastSeenAt,...metadata}=JSON.parse(contact.metadata_json);
  const result={lastSeenAt,contact:digest({...contact,metadata_json:JSON.stringify(metadata)}),authorityEpoch:digest(db.prepare('SELECT * FROM integration_authority_epoch').all())};
  for(const name of ['email_deliveries','ai_generations','native_integration_events','native_integration_intents']){
   const rows=db.prepare('SELECT * FROM '+name).all().map(row=>JSON.stringify(row)).sort();result[name]={count:rows.length,digest:digest(rows)};
  }
  return result;
 }finally{db.close();}
}

export function assertProfileReloadEffects(after,before,message){
 const {lastSeenAt:beforeSeen,...beforeState}=before,{lastSeenAt:afterSeen,...afterState}=after;
 assert.deepEqual(afterState,beforeState,message);
 assert.ok(Number.isFinite(beforeSeen)&&afterSeen>beforeSeen,'authenticated widget reload advances presence');
}
