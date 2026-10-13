import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../git.mjs';
import { validateSource } from '../validate-source.mjs';

test('fresh integration/release ancestry admits exact commits and rejects feature-only, malformed and foreign dispatches', () => {
  const root=mkdtempSync(join(tmpdir(),'h2h-refs-'));
  const localEnv={...process.env,GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
  const g=args=>git(root,args,{env:localEnv}).text;
  try {
    g(['init','-b','main']);writeFileSync(join(root,'file'),'one');g(['add','.']);g(['commit','-m','initial']);const first=g(['rev-parse','HEAD']);
    writeFileSync(join(root,'file'),'two');g(['commit','-am','second']);const tip=g(['rev-parse','HEAD']);
    g(['checkout','-b','feature']);writeFileSync(join(root,'file'),'three');g(['commit','-am','feature']);const feature=g(['rev-parse','HEAD']);
    const args={cwd:root,sha:first,dispatchSha:tip,dispatchRef:'refs/heads/main',event:'workflow_dispatch',repo:'just-every/run-happytohelp',mode:'stage',remote:root,env:localEnv};
    assert.equal(validateSource(args),first);
    for (const mutation of [{sha:feature},{sha:'HEAD'},{sha:'--help'},{sha:tip+'\necho bad'},{sha:tip.toUpperCase()},
      {repo:'octocat/Hello-World'},{event:'pull_request'},{dispatchRef:'refs/heads/feature'},{dispatchSha:feature},{mode:'proof',proof:'../../package.json'}])
      assert.throws(()=>validateSource({...args,...mutation}));
    g(['tag','scratch',feature]);assert.throws(()=>validateSource({...args,sha:feature}));
    g(['tag','v0.2.3-rc.1',feature]);assert.equal(validateSource({...args,sha:feature}),feature);
    g(['tag','-d','v0.2.3-rc.1']);assert.throws(()=>validateSource({...args,sha:feature}));
  } finally {rmSync(root,{recursive:true,force:true});}
});
