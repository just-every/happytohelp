import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateArtifact,materializeArtifact,digest} from '../artifact.mjs';
import {candidate,packageCandidate,writeCandidate} from './fixtures.mjs';
test('schema-2 validator independently verifies raw bytes, size, hash, role and paths',()=>{
 const {raw,payloads}=packageCandidate(candidate());assert.equal(validateArtifact(raw,digest(raw),payloads).length,3);
 for(const change of [a=>a.schema=1,a=>a.modules[0].sha256='0'.repeat(64),a=>a.modules[0].size++,a=>a.modules[0].role='asset',a=>a.modules[0].payload='../private',a=>a.modules[0].payload='payload/assets/000000',a=>a.modules[0].contentBase64='abc']){
  const a=JSON.parse(raw);change(a);const text=JSON.stringify(a);assert.throws(()=>validateArtifact(text,digest(text),payloads));
 }
 const tampered=new Map(payloads);tampered.set('payload/modules/000000',Buffer.from('tampered'));assert.throws(()=>validateArtifact(raw,digest(raw),tampered));
 const absent=new Map(payloads);absent.delete('payload/modules/000000');assert.throws(()=>validateArtifact(raw,digest(raw),absent));
});
test('schema-2 materialization refuses missing, changed, duplicate and symlink sidecars',async()=>{
 for(const mode of ['missing','bytes','size','duplicate','symlink','parent-symlink']){
  const root=await mkdtemp(join(tmpdir(),'h2h-schema2-'));
  try{
   const file=join(root,'artifact.json');let raw=await writeCandidate(file,candidate()),a=JSON.parse(raw),payload=join(root,'payload/modules/000000');
   if(mode==='missing')await rm(payload);
   if(mode==='bytes')await writeFile(payload,Buffer.alloc(a.modules[0].size,42));
   if(mode==='size')await writeFile(payload,'small');
   if(mode==='duplicate'){a.modules.push({...a.modules[0],name:'other.js'});raw=JSON.stringify(a);await writeFile(file,raw);}
   if(mode==='symlink'){await rm(payload);await writeFile(join(root,'outside'),'private');await symlink(join(root,'outside'),payload);}
   if(mode==='parent-symlink'){await rm(join(root,'payload/modules'),{recursive:true});await mkdir(join(root,'outside'));await writeFile(join(root,'outside/000000'),'private');await symlink(join(root,'outside'),join(root,'payload/modules'));}
   await assert.rejects(materializeArtifact(file,join(root,'out'),digest(raw)),mode);
  }finally{await rm(root,{recursive:true,force:true})}
 }
});
