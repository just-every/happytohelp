import {readArtifact,payloadBytes} from './helpers/artifact-payloads.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {deploymentSpec} from './helpers/delivery-oracle/deployment-spec.mjs';
import {deploymentSpec as baseSpec} from '../scripts/delivery/base/spec.mjs';
test('historical pre-Base oracle: candidate SQL and source-added topology survive declaration with exact hashes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'candidate-spec-'));
 try{
  await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'migrations'));
  const sql='ALTER TABLE outbound_email ADD COLUMN bcc_address TEXT;\n';
  await writeFile(join(root,'migrations/0042_bcc.sql'),sql);
  await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({compatibility_date:'2026-09-08',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',migrations_dir:'../../migrations'}],r2_buckets:[{binding:'NEW_ARCHIVE',bucket_name:'ignored-owner-name'}],queues:{producers:[{binding:'NEW_JOBS',queue:'new'},{binding:'FAILED_JOBS',queue:'failed'}],consumers:[{queue:'new',dead_letter_queue:'failed',max_retries:0}]},durable_objects:{bindings:[{name:'NEW_ROOM',class_name:'NewRoom'}]},migrations:[{tag:'room-v1',new_sqlite_classes:['NewRoom'],renamed_classes:[{from:'OldRoom',to:'RenamedRoom'}],transferred_classes:[{from:'SharedRoom',from_script:'source-worker',to:'AdoptedRoom'}]}],triggers:{crons:['*/5 * * * *']},vars:{PUBLIC_MODE:'enabled'}}));
  const spec=await deploymentSpec(root,{publicVariableNames:['PUBLIC_MODE'],optionalSecretNames:['OPTIONAL_PROVIDER_KEY'],recovery:'Backup first'});
  assert.deepEqual(await baseSpec(root,{providerEffects:[],publicVariableNames:['PUBLIC_MODE'],optionalSecretNames:['OPTIONAL_PROVIDER_KEY'],recovery:'Backup first'}),spec,'Current Base preserves the complete source-added topology and SQL declaration');
  assert.deepEqual(spec.migrations,[{binding:'DB',name:'0042_bcc.sql',sha256:createHash('sha256').update(sql).digest('hex'),sql}]);
  assert.ok(spec.resources.some(x=>x.binding==='NEW_ARCHIVE'));
  assert.equal(spec.queueConsumers[0].deadLetterBinding,'FAILED_JOBS');
  assert.equal(spec.durableObjects[0].className,'NewRoom');
  assert.deepEqual(spec.durableObjectMigrations[0].renamedClasses,[{from:'OldRoom',to:'RenamedRoom'}]);
  assert.deepEqual(spec.durableObjectMigrations[0].transferredClasses,[{from:'SharedRoom',fromScript:'source-worker',to:'AdoptedRoom'}]);
  assert.deepEqual(spec.schedules,['*/5 * * * *']);
  assert.ok(!JSON.stringify(spec).includes('ignored-owner-name'));
  await assert.rejects(deploymentSpec(root,{recovery:'Backup first'}),/Undeclared public/);
  await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({kv_namespaces:[{binding:'NEW_KV',id:'owner-id'}]}));
  await assert.rejects(deploymentSpec(root,{recovery:'Backup first'}),/Unsupported deployment binding/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('artifact producer preserves approved video and font bytes with browser MIME types',async()=>{
 const {produceArtifact,config}=await import('../scripts/delivery/build.mjs');
 const root=await mkdtemp(join(tmpdir(),'candidate-assets-'));
 try{
  await mkdir(join(root,'dist/server'),{recursive:true});
  await mkdir(join(root,'dist/client/assets'),{recursive:true});
  await writeFile(join(root,'dist/server/index.js'),'export default {};');
  await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({compatibility_date:'2026-09-08'}));
  const expected={'hero.mp4':'video/mp4','heading.woff':'font/woff','body.ttf':'font/ttf','body.woff2':'font/woff2'};
  for(const name of Object.keys(expected))await writeFile(join(root,'dist/client/assets',name),Buffer.from([0,1,2,255]));
  const path=await produceArtifact({root,config:{...config,edition:undefined}});
  const artifact=await readArtifact(path);
  assert.equal(artifact.assets.length,Object.keys(expected).length);
  for(const [name,contentType]of Object.entries(expected)){
   const asset=artifact.assets.find(asset=>asset.path===`/assets/${name}`);
   assert.equal(asset.contentType,contentType);
   assert.deepEqual(await payloadBytes(artifact,asset),Buffer.from([0,1,2,255]));
  }
 }finally{await rm(root,{recursive:true,force:true})}
});

test('historical pre-Base oracle: artifact excludes local credential files from both Worker modules and public assets',async()=>{
 const {produceArtifact}=await import('./helpers/delivery-oracle/producer.mjs');
 const root=await mkdtemp(join(tmpdir(),'candidate-private-'));
 try{
  await mkdir(join(root,'dist/server/nested'),{recursive:true});
  await mkdir(join(root,'dist/client/nested'),{recursive:true});
  await writeFile(join(root,'dist/server/index.js'),'export default {};');
  await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({compatibility_date:'2026-09-08'}));
  await writeFile(join(root,'dist/client/index.html'),'<main>Public application</main>');
  const marker='FIXTURE_PRIVATE_BINDING=must-not-leave-local-build';
  for(const directory of ['dist/server','dist/server/nested','dist/client','dist/client/nested']){
   for(const name of ['.dev.vars','.dev.vars.production','.env','.env.local','.env.production','.npmrc','.netrc']){
    await writeFile(join(root,directory,name),marker);
   }
  }
  const path=await produceArtifact({root});
  const artifact=JSON.parse(await readFile(path,'utf8'));
  assert.deepEqual(artifact.modules.map(module=>module.name),['index.js']);
  assert.deepEqual(artifact.assets.map(asset=>asset.path),['/index.html']);
  for(const entry of [...artifact.modules,...artifact.assets]){
   assert.ok(!Buffer.from(entry.contentBase64,'base64').toString().includes(marker));
  }
 }finally{await rm(root,{recursive:true,force:true})}
});
