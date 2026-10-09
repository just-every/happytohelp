import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { git, readAuthEnv } from './git.mjs';
import { integrationRef, releaseRefPattern, repository, requireSha, requireProof } from './policy.mjs';

function advertised(cwd, remote, env) {
  const lines = git(cwd, ['ls-remote', '--refs', remote, integrationRef, 'refs/tags/v*'], { env }).text;
  const refs = lines.split('\n').filter(Boolean).map(line => line.split(/\s+/));
  return refs.filter(([, ref]) => ref === integrationRef || releaseRefPattern.test(ref))
    .sort((a, b) => a[1].localeCompare(b[1]));
}
// No target code is loaded, imported, checked out or executed. Resolve fresh refs,
// not origin/main from checkout, and reject a changed advertisement (force pushes,
// moved/deleted tags) instead of blessing a stale ancestry snapshot.
export function validateSource({ cwd, sha, dispatchSha, dispatchRef, event, repo,
  proof, mode, remote = `https://github.com/${repository}.git`, env = process.env }) {
  requireSha(sha); requireSha(dispatchSha);
  if (event !== 'workflow_dispatch' || repo !== repository || dispatchRef !== integrationRef)
    throw new Error('invalid-dispatch');
  if (mode === 'proof') requireProof(proof);
  else if (mode !== 'stage') throw new Error('invalid-mode');
  const before = advertised(cwd, remote, env);
  if (!before.some(([, ref]) => ref === integrationRef)) throw new Error('missing-integration');
  git(cwd, ['fetch', '--no-tags', '--force', '--prune', remote,
    `+${integrationRef}:refs/live-proof/main`, '+refs/tags/v*:refs/live-proof/tags/v*'], { env });
  const after = advertised(cwd, remote, env);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('source-refs-changed');
  const commits = before.map(([oid, ref]) => {
    const local = ref === integrationRef ? 'refs/live-proof/main' : ref.replace('refs/tags/', 'refs/live-proof/tags/');
    if (git(cwd, ['rev-parse', '--verify', local]).text !== oid) throw new Error('source-refs-changed');
    return { ref, commit: git(cwd, ['rev-parse', '--verify', `${local}^{commit}`]).text };
  });
  const main = commits.find(item => item.ref === integrationRef).commit;
  const ancestor = (candidate, tip) => git(cwd, ['merge-base', '--is-ancestor', candidate, tip], { allowFailure: true }).ok;
  if (!ancestor(dispatchSha, main)) throw new Error('untrusted-workflow-sha');
  if (git(cwd, ['rev-parse', '--verify', `${sha}^{commit}`], { allowFailure: true }).text !== sha ||
      !commits.some(({ commit }) => ancestor(sha, commit))) throw new Error('unreachable-sha');
  return sha;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const sha = validateSource({ cwd: process.cwd(), sha: process.env.INPUT_SHA,
      dispatchSha: process.env.CONTROL_SHA, dispatchRef: process.env.GITHUB_REF,
      event: process.env.GITHUB_EVENT_NAME, repo: process.env.GITHUB_REPOSITORY,
      proof: process.env.INPUT_PROOF, mode: process.env.MODE,
      env: readAuthEnv(process.env.GH_READ_TOKEN ?? '') });
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
  } catch { console.error('Source validation rejected the request.'); process.exitCode = 1; }
}
