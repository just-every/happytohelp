import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {produceArtifact,config} from '../scripts/delivery/build.mjs';
import {portableResourceCapability} from '../scripts/delivery/base/capabilities.mjs';
import {deploymentSpec} from '../scripts/delivery/base/spec.mjs';
import {produceArtifact as oracle} from './helpers/delivery-oracle/producer.mjs';
import {readArtifact,payloadBytes} from './helpers/artifact-payloads.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('maintained Base rejects credential build entries and declares KV incomplete portability',async()=>{
 const root=await mkdtemp(join(tmpdir(),'h2h-base-policy-'));
 try{
  await mkdir(join(root,'dist/server'),{recursive:true}); await mkdir(join(root,'dist/client'));
  await writeFile(join(root,'dist/server/index.js'),'export default {};');
  await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({compatibility_date:'2026-09-08',kv_namespaces:[{binding:'NEW_KV',id:'owner-id'}]}));
  const spec=await deploymentSpec(root,{recovery:'Restore backup'});
  assert.ok(spec.resources.some(r=>r.binding==='NEW_KV'&&r.kind==='kv'));
  assert.equal(portableResourceCapability(spec).complete,false);
  assert.ok(!JSON.stringify(spec).includes('owner-id'));
  for(const name of ['.dev.vars','.dev.vars.production','.env','.env.local','.env.production','.npmrc','.netrc']){
   const privateFile=join(root,'dist/client',name);await writeFile(privateFile,'FIXTURE_PRIVATE_BINDING=must-not-leave-local-build');
   await assert.rejects(produceArtifact({root,config:{...config,edition:undefined}}),/Private/);
   await rm(privateFile);
  }
 }finally{await rm(root,{recursive:true,force:true})}
});
test('same emitted HappyToHelp candidate has exact old/Base spec and SHA-256 payload equality',async()=>{
 // Both producers read this build, never another revision or a saved historical answer.
 const folder=await mkdtemp(join(process.cwd(),'.delivery-parity-'));
 try{
  const old=JSON.parse(await readFile(await oracle({output:join(folder,'old/artifact.json')})));
  const path=await produceArtifact({output:relative(process.cwd(),join(folder,'base/artifact.json'))});
  const current=await readArtifact(path);
  assert.equal(old.schema,1);assert.equal(current.schema,2);assert.equal(current.mainModule,old.mainModule);
  assert.deepEqual(current.deploymentSpec,old.deploymentSpec);
  const mime=[];
  for(const [group,key] of [['modules','name'],['assets','path']]){
   assert.deepEqual(current[group].map(e=>e[key]),old[group].map(e=>e[key]));
   for(const [i,entry] of current[group].entries()){
    const prior=old[group][i],before=Buffer.from(prior.contentBase64,'base64'),after=await payloadBytes(current,entry);
    assert.equal(sha(after),sha(before),entry[key]);assert.deepEqual(after,before,entry[key]);
    if(group==='modules')assert.equal(entry.type,prior.type);
    else if(entry.contentType!==prior.contentType)mime.push({path:entry.path,before:prior.contentType,after:entry.contentType});
   }
  }
  assert.deepEqual(mime,['/fonts/inter/LICENSE.txt','/fonts/outfit/LICENSE.txt'].map(path=>({path,before:'application/octet-stream',after:'text/plain'})));
  console.log(JSON.stringify({modules:current.modules.length,assets:current.assets.length,migrations:current.deploymentSpec.migrations.length,mimeChanges:mime}));
 }finally{await rm(folder,{recursive:true,force:true})}
});
