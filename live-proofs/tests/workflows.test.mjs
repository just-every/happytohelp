import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sha } from './fixtures.mjs';

for (const workflow of ['deploy-stage','live-proof']) test(`${workflow}: isolated fresh runners and fixed credential boundary`, () => {
  const source=readFileSync(`.github/workflows/${workflow}.yml`,'utf8');
  const prepare=source.split('  prepare:\n')[1].split('  execute:\n')[0];
  const execute=source.split('  execute:\n')[1].split('  receipt:\n')[0];
  const receipt=source.split('  receipt:\n')[1];
  assert.equal((source.match(/runs-on: ubuntu-24.04/g)||[]).length,4);
  assert.match(source,/on:\n  workflow_dispatch:/);assert.doesNotMatch(source,/\n  (push|pull_request|workflow_call):/);
  assert.doesNotMatch(prepare,/\n    environment:|secrets\./);
  assert.match(execute,/needs: \[validate, prepare\]/);
  assert.match(execute,/needs\.prepare\.result == 'success'/);
  assert.doesNotMatch(execute,/ref: \$\{\{ needs\.validate\.outputs\.sha \}\}|EVIDENCE_WRITE_TOKEN|pnpm run|source\/|\.\/scripts/);
  assert.doesNotMatch(receipt,/CLOUDFLARE_API_TOKEN|H2H_SETUP_TOKEN|download-artifact|needs\.prepare\.outputs/);
  assert.match(receipt,/always\(\) && needs\.validate\.result == 'success'/);
  for (const use of source.matchAll(/uses: (\S+)/g)) assert.match(use[1],/@[0-9a-f]{40}$/);
  assert.equal((source.match(/EVIDENCE_WRITE_TOKEN: \$\{\{ secrets\.EVIDENCE_WRITE_TOKEN \}\}/g)||[]).length,1);
  if(workflow==='deploy-stage') {
    assert.match(prepare,/pnpm run verify\n          sha256sum delivery-artifact\/happytohelp-worker-artifact\.json/);
    // Bash errexit (the Actions default) must stop before packaging/deploy.
    const result=spawnSync('bash',['-e','-c','false\nprintf unsafe-deploy'],{encoding:'utf8'});
    assert.equal(result.status,1);assert.equal(result.stdout,'');
  }
  const guard=source.split('        run: |\n')[1].split('      - uses:')[0].split('\n').filter(Boolean).map(l=>l.slice(10)).join('\n');
  const base={PATH:process.env.PATH,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'just-every/happytohelp',GITHUB_REF:'refs/heads/main',INPUT_SHA:sha,CONTROL_SHA:sha};
  assert.equal(spawnSync('bash',['--noprofile','--norc','-e','-c',guard],{env:base}).status,0);
  for(const delta of [{INPUT_SHA:'$(touch /tmp/h2h-unsafe)'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_REPOSITORY:'attacker/fork'}])
    assert.equal(spawnSync('bash',['--noprofile','--norc','-e','-c',guard],{env:{...base,...delta}}).status,1);
});
