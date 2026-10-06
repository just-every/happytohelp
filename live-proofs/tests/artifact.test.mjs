import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateArtifact, materializeArtifact, digest } from '../artifact.mjs';
import { targetPolicy } from '../target.mjs';
import { deployStage, health } from '../stage-adapter.mjs';
import { candidate, policy, sha, env } from './fixtures.mjs';

test('target policy binds exact source/digest and forbids production/custom domains', () => {
  assert.equal(targetPolicy(JSON.stringify(policy()),sha).sourceSha,sha);
  for (const change of [{sourceSha:'3'.repeat(40)},{artifactSha256:'latest'},{prefix:'production'},{isolation:'production'},
    {origin:'https://app.happytohelp.com'},{origin:'https://help.justevery.com'},{origin:'https://fixture-stage.fixture.workers.dev@evil.example'},
    {origin:'https://fixture-stage.fixture.workers.dev/path'},{origin:'https://fixture-stage.fixture.workers.dev:443'},{extra:'command'}])
    assert.throws(() => targetPolicy(JSON.stringify({...policy(),...change}),sha));
  assert.throws(() => targetPolicy('',sha),/stage-target-unconfigured/);
});
test('artifact rejects malicious paths, config, duplicate entries, bindings, bytes and mismatched digest', () => {
  const c = candidate(), raw=JSON.stringify(c);
  assert.equal(validateArtifact(raw,digest(raw)).length,3);
  assert.throws(() => validateArtifact(raw,'0'.repeat(64)));
  for (const name of ['../outside.js','/outside.js','a/../../x.js','.npmrc','package.json','a/package.json','a/.dev.vars','wrangler.json','node_modules/a.js','x\nsecret.js']) {
    const a=candidate();a.modules[0].name=name;
    const text=JSON.stringify(a);assert.throws(()=>validateArtifact(text,digest(text)));
  }
  for (const change of [a=>a.modules.push(a.modules[0]),a=>a.modules[0].contentBase64='!bad',a=>a.deploymentSpec.resources.push({kind:'kv',binding:'TOKEN'}),
    a=>a.deploymentSpec.publicVariables={NODE_OPTIONS:'--import=/tmp/payload'},a=>a.deploymentSpec.migrations[0].name='../0001.sql',
    a=>a.deploymentSpec.migrations[0].sha256='0'.repeat(64),a=>a.assets[0].path='index.html']) {
    const a=candidate();change(a);const text=JSON.stringify(a);assert.throws(()=>validateArtifact(text,digest(text)));
  }
});
test('adapter materializes data only, invokes migrations then unbundled deploy; failure stops health', async () => {
  const root=await mkdtemp(join(tmpdir(),'h2h-adapter-test-'));
  try {
    const a=candidate();
    a.modules[0].contentBase64=Buffer.from('throw new Error("must never execute locally"); export default {}; export class ConversationSocket {}').toString('base64');
    const raw=JSON.stringify(a), p=policy(a), file=join(root,'artifact.json');await writeFile(file,raw);
    const e=env({RUNNER_TEMP:root,H2H_STAGE_POLICY_JSON:JSON.stringify(p),EVIDENCE_WRITE_TOKEN:'test-store-token',NODE_OPTIONS:'--import=evil'});
    const calls=[];
    const invoke=(tool,args,cwd,childEnv)=> {
      assert.ok(tool.endsWith('/toolchain/node_modules/wrangler/bin/wrangler.js'));
      assert.equal(childEnv.EVIDENCE_WRITE_TOKEN,undefined);assert.equal(childEnv.H2H_SETUP_TOKEN,undefined);assert.equal(childEnv.NODE_OPTIONS,undefined);
      calls.push(args);return true;
    };
    assert.equal((await deployStage({sha,artifact:file,env:e,invoke,checkHealth:async origin=>origin===p.origin})).result,'passed');
    assert.deepEqual(calls.map(c=>c[0]),['d1','deploy']);assert.ok(calls[1].includes('--no-bundle'));
    let checked=false;
    assert.equal((await deployStage({sha,artifact:file,env:e,invoke:()=>false,checkHealth:async()=>{checked=true;}})).result,'migration-failed');
    assert.equal(checked,false);
    let i=0;
    assert.equal((await deployStage({sha,artifact:file,env:e,invoke:()=>++i===1,checkHealth:async()=>{checked=true;}})).result,'deploy-failed');
    assert.equal(checked,false);
    assert.equal((await deployStage({sha,artifact:file,env:e,invoke:()=>true,checkHealth:async()=>false})).result,'health-failed');
    await symlink(file,join(root,'link.json'));
    await assert.rejects(materializeArtifact(join(root,'link.json'),join(root,'out'),digest(raw)));
    await assert.rejects(deployStage({sha,artifact:file,env:{...e,H2H_RESOURCE_PREFIX:'wrong'},invoke:()=>assert.fail('provider called')}));
  } finally {await rm(root,{recursive:true,force:true});}
});
test('health requires full native DB/R2 response and rejects redirects and misleading 200', async () => {
  for (const body of [{status:'ok'},{status:'ok',runtime:'native-rer',database:'reachable',files:'unreachable'}])
    assert.equal(await health('https://fixture.example',async()=>Response.json(body)),false);
  assert.equal(await health('https://fixture.example',async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:302})}),false);
  assert.equal(await health('https://fixture.example',async()=>Response.json({status:'ok',runtime:'native-rer',database:'reachable',files:'reachable'})),true);
});
