// Run after npm ci --ignore-scripts in live-proofs/toolchain. Uses the real
// pinned Wrangler offline packaging path; no account, credential or provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { candidate, policy } from './fixtures.mjs';
import { materializeArtifact } from '../artifact.mjs';
import { configuration } from '../stage-adapter.mjs';

test('real Wrangler accepts controller topology and packages malicious module as inert data', async()=>{
  const root=await mkdtemp(join(tmpdir(),'h2h-wrangler-test-'));
  try {
    const marker=join(root,'must-not-exist');
    const a=candidate();
    a.modules[0].contentBase64=Buffer.from(`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');export default {fetch(){return new Response('ok')}};export class ConversationSocket {}`).toString('base64');
    const p=policy(a);await writeFile(join(root,'a.json'),JSON.stringify(a));
    await materializeArtifact(join(root,'a.json'),join(root,'out'),p.artifactSha256);
    await writeFile(join(root,'out/wrangler.json'),JSON.stringify(configuration(p)));
    await writeFile(join(root,'out/secrets.json'),JSON.stringify({H2H_SETUP_TOKEN:'test-private-setup-token-with-32-characters'}));
    const result=spawnSync(process.execPath,[resolve('live-proofs/toolchain/node_modules/wrangler/bin/wrangler.js'),'deploy','--dry-run','--no-bundle','--config','wrangler.json','--secrets-file','secrets.json'],
      {cwd:join(root,'out'),env:{PATH:process.env.PATH,HOME:root,CI:'true',WRANGLER_SEND_METRICS:'false'},encoding:'utf8',timeout:60000});
    assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout,/--dry-run: exiting now/);
    await assert.rejects(access(marker));
  } finally {await rm(root,{recursive:true,force:true});}
});
