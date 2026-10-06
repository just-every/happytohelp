import test from 'node:test';
import assert from 'node:assert/strict';
import { candidate } from './fixtures.mjs';
import { validateArtifact, digest } from '../artifact.mjs';

test('large native assets and Vite metadata remain data; build ignore rules cannot suppress approved assets',()=>{
  const a=candidate();
  a.assets[0].contentBase64=Buffer.alloc(2*1024*1024,7).toString('base64');
  a.modules.push({name:'.vite/manifest.json',type:'text',contentBase64:Buffer.from('{}').toString('base64')});
  a.assets.push({path:'/.assetsignore',contentBase64:Buffer.from('*').toString('base64'),contentType:'text/plain'});
  const raw=JSON.stringify(a), files=validateArtifact(raw,digest(raw));
  assert.ok(files.some(f=>f.path==='modules/.vite/manifest.json'));
  assert.equal(files.find(f=>f.path==='assets/index.html').bytes.length,2*1024*1024);
  assert.ok(!files.some(f=>f.path.endsWith('.assetsignore')));
  for(const encoded of ['Zg=','Zh==','Zg==\n','-g==']) {
    const b=candidate();b.assets[0].contentBase64=encoded;const body=JSON.stringify(b);
    assert.throws(()=>validateArtifact(body,digest(body)));
  }
});
