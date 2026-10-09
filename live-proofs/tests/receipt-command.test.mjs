import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeReceipt, validateReceipt } from '../receipt.mjs';
import { persistToGit } from '../git-store.mjs';
import { git } from '../git.mjs';
import { env, policy } from './fixtures.mjs';

const command = 'node control/live-proofs/run.mjs';
function localStore(t) {
  const root = mkdtempSync(join(tmpdir(), 'h2h-command-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const gitEnv = { PATH: process.env.PATH, HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  const store = join(root, 'store.git');
  git(root, ['init', '--bare', store], { env: gitEnv });
  const tree = git(store, ['mktree'], { env: gitEnv, input: '' }).text;
  const initial = git(store, ['commit-tree', tree], { env: gitEnv, input: 'initial\n' }).text;
  git(store, ['update-ref', 'refs/heads/main', initial], { env: gitEnv });
  const transport = { remote: store, tempRoot: root, env: gitEnv };
  return { root, store, gitEnv, transport };
}

test('proof and stage commands exactly match the immutable workflow execute steps', () => {
  for (const mode of ['proof', 'stage']) {
    const receipt = makeReceipt(env({ MODE: mode, ARTIFACT_SHA256: policy().artifactSha256 }));
    const yaml = readFileSync(`.github/workflows/${receipt.workflow}.yml`, 'utf8');
    const execute = yaml.split('  execute:\n')[1].split('  receipt:\n')[0];
    const run = execute.split('      - name: Run reviewed controller with provider credentials only\n')[1]
      .match(/^        run: (.+)$/m)[1];
    assert.equal(receipt.command, command);
    assert.equal(receipt.command, run);
    assert.match(execute, new RegExp(`MODE: ${mode}\\n`));
    assert.equal(validateReceipt(receipt), receipt);
  }
});

test('actual names-only proof success and failure persist the invoked command and run bindings', t => {
  const { root, store, gitEnv, transport } = localStore(t);
  cpSync(resolve('live-proofs'), join(root, 'control/live-proofs'), { recursive: true });
  for (const [attempt, token, result] of [['1', 'test-setup-secret', 'passed'], ['2', '', 'failed']]) {
    const output = join(root, `output-${attempt}`);
    const inputs = env({ PATH: process.env.PATH, HOME: root, GITHUB_OUTPUT: output,
      GITHUB_RUN_ATTEMPT: attempt, H2H_SETUP_TOKEN: token });
    const planned = makeReceipt(inputs);
    const run = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', planned.command],
      { cwd: root, env: inputs, encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, result === 'passed' ? 0 : 1, run.stderr);
    assert.equal(run.stdout, `CLOUDFLARE_API_TOKEN\n${token ? 'H2H_SETUP_TOKEN\n' : ''}`);
    assert.equal(run.stderr, '');
    const outputs = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
    const receipt = makeReceipt({ ...inputs, JOB_RESULT: run.status === 0 ? 'success' : 'failure',
      EXECUTION_RESULT: outputs.result, STARTED: outputs.started, FINISHED: outputs.finished });
    assert.equal(receipt.result, result);
    assert.equal(receipt.failureStatus, result === 'passed' ? null : 'missing-secret');
    assert.equal(receipt.command, planned.command);
    assert.equal(receipt.sha, inputs.VALIDATED_SHA);
    assert.equal(receipt.controlSha, inputs.CONTROL_SHA);
    assert.equal(receipt.runId, inputs.GITHUB_RUN_ID);
    assert.equal(receipt.runAttempt, attempt);
    assert.equal(receipt.proof, 'secrets-present');
    assert.ok(receipt.startedUtc && receipt.finishedUtc && receipt.recordedUtc);
    const path = persistToGit(validateReceipt(receipt), transport);
    const stored = JSON.parse(git(store, ['show', `main:${path}`], { env: gitEnv }).text);
    assert.deepEqual(stored, receipt);
    assert.equal(validateReceipt(stored), stored);
    assert.throws(() => persistToGit(receipt, transport), /receipt-already-exists/);
    assert.ok(!JSON.stringify(stored).includes(inputs.CLOUDFLARE_API_TOKEN));
  }
});

test('actual trusted stage runner failure records its command without attempting a provider call', t => {
  const { root, store, gitEnv, transport } = localStore(t);
  cpSync(resolve('live-proofs'), join(root, 'control/live-proofs'), { recursive: true });
  const output = join(root, 'stage-output');
  const inputs = env({ PATH: process.env.PATH, HOME: root, MODE: 'stage', INPUT_PROOF: '',
    H2H_STAGE_POLICY_JSON: '', CLOUDFLARE_API_TOKEN: '', H2H_SETUP_TOKEN: '', GITHUB_OUTPUT: output });
  const planned = makeReceipt({ ...inputs, EXECUTION_RESULT: '', JOB_RESULT: 'skipped' });
  const run = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', planned.command],
    { cwd: root, env: inputs, encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 1);
  assert.equal(run.stdout + run.stderr, '');
  const outputs = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
  const receipt = makeReceipt({ ...inputs, JOB_RESULT: 'failure', EXECUTION_RESULT: outputs.result,
    STARTED: outputs.started, FINISHED: outputs.finished });
  assert.equal(receipt.command, command);
  assert.equal(receipt.result, 'failed');
  assert.equal(receipt.failureStatus, 'stage-target-unconfigured');
  assert.equal(receipt.proof, null);
  const path = persistToGit(receipt, transport);
  assert.deepEqual(JSON.parse(git(store, ['show', `main:${path}`], { env: gitEnv }).text), receipt);
});

test('stage success metadata and every failure status retain the command through real Git persistence', t => {
  const { store, gitEnv, transport } = localStore(t);
  const cases = [
    ['passed', 'success', 'success'], ['missing-secret', 'success', 'failure'],
    ['stage-target-unconfigured', 'success', 'failure'], ['invalid-stage-policy', 'success', 'failure'],
    ['invalid-artifact', 'success', 'failure'], ['migration-failed', 'success', 'failure'],
    ['deploy-failed', 'success', 'failure'], ['health-failed', 'success', 'failure'],
    ['', 'success', 'skipped'], ['passed', 'failure', 'skipped'], ['passed', 'success', 'cancelled'],
  ];
  for (const [index, [status, prepare, job]] of cases.entries()) {
    const receipt = makeReceipt(env({ MODE: 'stage', GITHUB_RUN_ID: String(200 + index),
      EXECUTION_RESULT: status, PREPARE_RESULT: prepare, JOB_RESULT: job, ARTIFACT_SHA256: policy().artifactSha256 }));
    assert.equal(receipt.command, command);
    assert.equal(receipt.result, index === 0 ? 'passed' : 'failed');
    assert.equal(receipt.failureStatus, prepare !== 'success' ? 'prepare-failed' :
      job === 'cancelled' || !status ? 'execution-failed' : status === 'passed' ? null : status);
    assert.equal(receipt.startedUtc, null);
    assert.equal(receipt.finishedUtc, null);
    const path = persistToGit(validateReceipt(receipt), transport);
    assert.deepEqual(JSON.parse(git(store, ['show', `main:${path}`], { env: gitEnv }).text), receipt);
  }
});

test('untrusted command inputs cannot choose the command and forged receipts never change Git', t => {
  const { store, gitEnv, transport } = localStore(t);
  for (const mode of ['proof', 'stage']) {
    const receipt = makeReceipt(env({ MODE: mode, ARTIFACT_SHA256: policy().artifactSha256,
      command: 'untrusted', COMMAND: 'untrusted', INPUT_COMMAND: 'untrusted', EXECUTION_COMMAND: 'untrusted' }));
    assert.equal(receipt.command, command);
    const { command: omitted, ...missing } = receipt;
    const before = git(store, ['rev-parse', 'main'], { env: gitEnv }).text;
    for (const forged of [missing, ...['', null, ['node', 'control/live-proofs/run.mjs'],
      `${command}\n`, `${command}; echo untrusted`, 'node live-proofs/run.mjs', 'pnpm run deploy']
      .map(value => ({ ...receipt, command: value })),
      { ...receipt, workflow: 'untrusted' }, { ...receipt, proof: 'untrusted' },
      { ...receipt, commandSource: 'untrusted' }]) {
      assert.throws(() => validateReceipt(forged));
      assert.throws(() => persistToGit(forged, transport));
      assert.equal(git(store, ['rev-parse', 'main'], { env: gitEnv }).text, before);
    }
  }
  for (const delta of [{ MODE: 'untrusted' }, { INPUT_PROOF: 'constructor' }, { INPUT_PROOF: 'untrusted' },
    { EXECUTION_RESULT: 'untrusted' }]) assert.throws(() => makeReceipt(env(delta)));
});
