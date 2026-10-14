import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {parseJsonc} from '@runeditrun/rer/jsonc';
import {catalogue,policy} from '@runeditrun/rer/modules/portability/catalogue';
import {archivePolicy} from '../../scripts/installer/portability-policy.mjs';

// Open real D1/R2 only after rer has stopped its application owner.
export async function archiveStorage(root,visit){
 const {getPlatformProxy}=createRequire(join(root,'package.json'))('wrangler');
 const proxy=await getPlatformProxy({configPath:join(root,'wrangler.jsonc'),envFiles:[],remoteBindings:false,persist:{path:join(root,'.wrangler/state/v3')}});
 try{return await visit(proxy.env)}finally{await proxy.dispose()}
}
export async function archiveSnapshot(root){return archiveStorage(root,async({DB,FILES})=>{
 const config=policy(archivePolicy),inventory=await catalogue(DB,config),rows={};
 // Use the package's excludedTables policy, including all migration ledgers.
 for(const {name} of inventory.tables){const data=(await DB.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all()).results;rows[name]=data.map(row=>{for(const column of config.secretColumns[name]??[])row[column]=null;return JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))}).sort()}
 const objects=[];let cursor;do{const page=await FILES.list({...(cursor?{cursor}:{})});for(const {key} of page.objects){const object=await FILES.get(key);objects.push({key,bytes:Array.from(new Uint8Array(await object.arrayBuffer())),httpMetadata:object.httpMetadata,customMetadata:object.customMetadata})}cursor=page.truncated?page.cursor:undefined}while(cursor);
 return {rows,objects:objects.sort((a,b)=>a.key.localeCompare(b.key)),excludedTables:inventory.excludedTables};
})}
export async function retainHistoricalLedger(root){return archiveStorage(root,async({DB})=>{
 const config=parseJsonc(await readFile(join(root,'wrangler.jsonc'),'utf8')),directory=config.d1_databases.find(x=>x.binding==='DB').migrations_dir;
 const rows=(await DB.prepare('SELECT id,name,applied_at FROM d1_migrations ORDER BY id').all()).results;
 await DB.prepare("CREATE TABLE _rer_deploy_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('applying','applied')))").run();
 for(const row of rows){const sql=await readFile(join(root,directory,row.name));await DB.prepare("INSERT INTO _rer_deploy_migrations VALUES (?,?,'applied')").bind(row.name,createHash('sha256').update(sql).digest('hex')).run()}
 return rows;
})}
export async function assertHistoricalLedger(root,expected){return archiveStorage(root,async({DB})=>{
 assert.deepEqual((await DB.prepare('SELECT id,name,applied_at FROM d1_migrations ORDER BY id').all()).results,expected);
 assert.equal((await DB.prepare('SELECT count(*) n FROM _rer_deploy_migrations').first()).n,expected.length);
})}
export function compareArchive(before,after,added=[]){
 for(const name of added){assert.deepEqual(after.rows[name],[]);delete after.rows[name]}
 for(const name of new Set([...Object.keys(before.rows),...Object.keys(after.rows)]))if(JSON.stringify(before.rows[name])!==JSON.stringify(after.rows[name]))console.log(JSON.stringify({proof:'archive-difference',table:name,beforeRows:before.rows[name]?.length??0,afterRows:after.rows[name]?.length??0}));
 assert.deepEqual(after.rows,before.rows,'all portable D1 rows including import custody and erasure fences survive');
 assert.deepEqual(after.objects,before.objects,'all R2 bytes and metadata survive');
}

// Setup/dev intentionally issue one fresh local sign-in. Validate its entire
// receipt against native token and outbox custody, then compare every table.
export async function compareSignInArchive(root,before,after,{email,ownerId,origin,since}){
 const previous=new Set(before.rows.email_deliveries),added=after.rows.email_deliveries.filter(row=>!previous.has(row));
 assert.equal(added.length,1,'exactly one fresh local sign-in receipt');
 const receipt=JSON.parse(added[0]),projectId=before.rows.memberships.map(JSON.parse).filter(row=>row.user_id===ownerId).map(row=>row.project_id).sort()[0]??null;
 assert.match(receipt.id,/^magic-signin:[a-f0-9]{64}$/);
 assert.equal(receipt.recipient,email);assert.equal(receipt.project_id,projectId);
 assert.equal(receipt.state,'sent');assert.equal(receipt.provider_id,null);assert.equal(receipt.error,null);
 assert.ok(receipt.created_at>=since&&receipt.updated_at>=receipt.created_at&&receipt.updated_at<=Date.now());
 await archiveStorage(root,async({DB})=>{
  const hash=receipt.id.slice('magic-signin:'.length),token=await DB.prepare('SELECT * FROM magic_signins WHERE token_hash=?').bind(hash).first();
  assert.ok(token);assert.equal(token.user_id,ownerId);assert.equal(token.project_id,projectId);assert.equal(token.email,email);assert.equal(token.consumed_at,null);assert.ok(token.expires_at>receipt.created_at);
  const outbox=(await DB.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(receipt.id).all()).results;
  assert.equal(outbox.length,1);const message=JSON.parse(outbox[0].message);
  assert.deepEqual(message.to,[email]);assert.equal(message.subject,receipt.subject);
  const link=new URL(message.text.match(/https?:\/\/\S+/)?.[0]);assert.equal(link.origin,origin);assert.equal(link.pathname,'/login/magic');assert.equal(link.searchParams.get('returnTo'),'/setup');
  assert.equal(createHash('sha256').update(new URLSearchParams(link.hash.slice(1)).get('token')).digest('hex'),hash);
  const intent={to:email,subject:message.subject,text:message.text,projectId:projectId??undefined,idempotencyKey:receipt.id,from:message.from};
  assert.equal(receipt.intent_hash,createHash('sha256').update(JSON.stringify(intent)).digest('hex'));
 });
 const expected=structuredClone(before);expected.rows.email_deliveries.push(added[0]);expected.rows.email_deliveries.sort();
 compareArchive(expected,after);
}
