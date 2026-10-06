import { repository, requireProof, requireSha } from './policy.mjs';
// Writer-owned commands from the immutable controller's execute jobs. Never
// source this field from dispatch, candidate data or provider step output.
const commands = Object.freeze({
  'live-proof': Object.freeze({ 'secrets-present': 'node control/live-proofs/run.mjs' }),
  'deploy-stage': 'node control/live-proofs/run.mjs',
});
const statuses = new Set(['passed','missing-secret','stage-target-unconfigured','invalid-stage-policy','invalid-artifact','migration-failed','deploy-failed','health-failed','execution-failed','prepare-failed']);
const jobStatuses = new Set(['success','failure','cancelled','skipped']);
const utc = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) && !Number.isNaN(Date.parse(x));
export function makeReceipt(env, now=new Date().toISOString()) {
  const sha = requireSha(env.VALIDATED_SHA), controlSha = requireSha(env.CONTROL_SHA);
  if (env.GITHUB_REPOSITORY !== repository || !/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID) ||
      !/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ATTEMPT) || !jobStatuses.has(env.JOB_RESULT) || !jobStatuses.has(env.PREPARE_RESULT)) throw new Error('invalid-run');
  if (!['proof','stage'].includes(env.MODE)) throw new Error('invalid-mode');
  const proof = env.MODE === 'proof' ? requireProof(env.INPUT_PROOF) : null;
  const workflow = env.MODE === 'proof' ? 'live-proof' : 'deploy-stage';
  const command = env.MODE === 'proof' ? commands[workflow][proof] : commands[workflow];
  let status = env.EXECUTION_RESULT || 'execution-failed';
  if (!statuses.has(status)) throw new Error('invalid-result');
  if (env.PREPARE_RESULT !== 'success') status = 'prepare-failed';
  if (status === 'passed' && env.JOB_RESULT !== 'success') status = 'execution-failed';
  const artifactSha256 = env.ARTIFACT_SHA256 || null;
  if (artifactSha256 !== null && !/^[0-9a-f]{64}$/.test(artifactSha256)) throw new Error('invalid-digest');
  if (status === 'passed' && env.MODE === 'stage' && !artifactSha256) throw new Error('missing-digest');
  for (const value of [env.STARTED,env.FINISHED,now]) if (value && !utc(value)) throw new Error('invalid-time');
  return {version:1,repository,workflow,proof,command,sha,controlSha,
    artifactSha256,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,startedUtc:env.STARTED || null,
    finishedUtc:env.FINISHED || null,recordedUtc:now,result:status === 'passed' ? 'passed' : 'failed',
    failureStatus:status === 'passed' ? null : status,jobResult:env.JOB_RESULT,prepareResult:env.PREPARE_RESULT};
}
export function validateReceipt(receipt) {
  const value = makeReceipt({VALIDATED_SHA:receipt.sha,CONTROL_SHA:receipt.controlSha,GITHUB_REPOSITORY:receipt.repository,
    MODE:receipt.workflow === 'live-proof' ? 'proof' : 'stage',INPUT_PROOF:receipt.proof,GITHUB_RUN_ID:receipt.runId,
    GITHUB_RUN_ATTEMPT:receipt.runAttempt,JOB_RESULT:receipt.jobResult,PREPARE_RESULT:receipt.prepareResult,
    EXECUTION_RESULT:receipt.failureStatus || receipt.result,ARTIFACT_SHA256:receipt.artifactSha256,
    STARTED:receipt.startedUtc,FINISHED:receipt.finishedUtc},receipt.recordedUtc);
  if (!utc(receipt.recordedUtc) || JSON.stringify(value) !== JSON.stringify(receipt)) throw new Error('invalid-receipt-schema');
  return receipt;
}
