import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { providerSecrets, requireProof, requireSha } from './policy.mjs';
import { deployStage } from './stage-adapter.mjs';

export async function execute(env=process.env) {
  requireSha(env.VALIDATED_SHA);
  if (env.MODE === 'proof') {
    requireProof(env.INPUT_PROOF);
    for (const name of providerSecrets) if (env[name]?.trim()) console.log(name);
    return {result:providerSecrets.every(name => env[name]?.trim()) ? 'passed' : 'missing-secret'};
  }
  if (env.MODE !== 'stage') throw new Error('invalid-mode');
  return deployStage({sha:env.VALIDATED_SHA,artifact:env.ARTIFACT_FILE,env});
}
export async function run(env=process.env) {
  const started = new Date().toISOString();
  let output = {result:'execution-failed'};
  try { output = await execute(env); } catch (error) {
    if (['stage-target-unconfigured','invalid-stage-policy','invalid-artifact'].includes(error.message)) output.result = error.message;
  }
  appendFileSync(env.GITHUB_OUTPUT,`result=${output.result}\nartifact_sha256=${output.artifactSha256 ?? ''}\nstarted=${started}\nfinished=${new Date().toISOString()}\n`);
  return output.result === 'passed' ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await run();
