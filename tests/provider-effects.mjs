import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {produceArtifact} from '../scripts/build-delivery-artifact.mjs';
import {specInputs} from '../scripts/delivery/spec-inputs.mjs';

test('HappyToHelp artifact retains the complete provider-effect declaration',async()=>{
 const effects=['ai','outbound-mail','knowledge-crawl','knowledge-vector-store','support-imports','github','website-fetch','turnstile'];
 assert.deepEqual(specInputs.providerEffects,effects);
 const root=await mkdtemp(join(tmpdir(),'h2h-provider-effects-'));
 try{
  await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'dist/client'));
  await writeFile(join(root,'dist/server/index.js'),'export default {};');
  await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({compatibility_date:'2026-09-08'}));
  const artifact=JSON.parse(await readFile(await produceArtifact({root}),'utf8'));
  assert.deepEqual(artifact.deploymentSpec.providerEffects,effects);
 }finally{await rm(root,{recursive:true,force:true});}
});
