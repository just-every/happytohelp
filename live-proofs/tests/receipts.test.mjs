import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeReceipt, validateReceipt } from '../receipt.mjs';
import { persistToGit } from '../git-store.mjs';
import { git } from '../git.mjs';
import { env } from './fixtures.mjs';

test('failed secrets proof prints names only and persists a fixed failure to bare evidence store', () => {
  const root=mkdtempSync(join(tmpdir(),'h2h-receipt-'));
  try {
    const output=join(root,'outputs');
    const e=env({GITHUB_OUTPUT:output,H2H_SETUP_TOKEN:'',EVIDENCE_WRITE_TOKEN:'not-forwarded-test'});
    const run=spawnSync(process.execPath,[resolve('live-proofs/run.mjs')],{env:e,encoding:'utf8'});
    assert.equal(run.status,1);assert.equal(run.stdout,'CLOUDFLARE_API_TOKEN\n');assert.equal(run.stderr,'');
    assert.ok(!run.stdout.includes(e.CLOUDFLARE_API_TOKEN));
    const values=Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').map(x=>x.split('=')));
    const receipt=makeReceipt({...e,JOB_RESULT:'failure',EXECUTION_RESULT:values.result,STARTED:values.started,FINISHED:values.finished});
    assert.equal(receipt.result,'failed');assert.equal(receipt.failureStatus,'missing-secret');
    const store=join(root,'store');git(root,['init','--bare',store]);
    const gitEnv={...process.env,GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
    const tree=git(store,['mktree'],{env:gitEnv,input:''}).text;
    const initial=git(store,['commit-tree',tree],{env:gitEnv,input:'initial\n'}).text;
    git(store,['update-ref','refs/heads/main',initial]);
    const path=persistToGit(receipt,{remote:store,tempRoot:root,env:gitEnv});
    assert.deepEqual(JSON.parse(git(store,['show',`main:${path}`]).text),receipt);
    assert.throws(()=>persistToGit(receipt,{remote:store,tempRoot:root,env:gitEnv}),/receipt-already-exists/);
    assert.ok(!JSON.stringify(receipt).includes('test-provider-token'));
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('failed verification and skipped deploy can never be a passed receipt; arbitrary payload cannot be persisted', () => {
  const receipt=makeReceipt(env({MODE:'stage',INPUT_PROOF:'',PREPARE_RESULT:'failure',JOB_RESULT:'skipped',EXECUTION_RESULT:'passed'}));
  assert.equal(receipt.result,'failed');assert.equal(receipt.failureStatus,'prepare-failed');
  validateReceipt(receipt);
  assert.throws(()=>validateReceipt({...receipt,token:'extra-data'}),/invalid-receipt-schema/);
  for (const override of [{EXECUTION_RESULT:'secret-content'},{GITHUB_RUN_ID:'../../escape'},{STARTED:'secret-content'},{ARTIFACT_SHA256:'secret-content'},
    {VALIDATED_SHA:'HEAD'},{INPUT_PROOF:'constructor'},{MODE:'stage',ARTIFACT_SHA256:''}]) assert.throws(()=>makeReceipt(env(override)));
});
