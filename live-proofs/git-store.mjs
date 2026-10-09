import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './git.mjs';
import { evidencePrefix } from './policy.mjs';
import { validateReceipt } from './receipt.mjs';

// This transport helper accepts a remote for isolated local Git tests. The only
// production entrypoint reads protected Environment policy; no CLI remote/path input.
export function persistToGit(receipt, { remote, tempRoot, env = process.env }) {
  validateReceipt(receipt);
  const directory = mkdtempSync(join(tempRoot, 'receipt-store-'));
  const path = `${evidencePrefix}/${receipt.repository.replace('/', '--')}/${receipt.workflow}/${receipt.runId}-${receipt.runAttempt}.json`;
  const body = `${JSON.stringify(receipt, null, 2)}\n`;
  try {
    // Bare object/index operations never check out evidence, run filters, execute
    // hooks, follow store symlinks or copy payloads from the proof's filesystem.
    git(directory, ['init', '--bare'], { env });
    const indexEnv = { ...env, GIT_INDEX_FILE: join(directory, 'receipt-index'),
      GIT_AUTHOR_NAME: 'Live proof receipts', GIT_AUTHOR_EMAIL: 'receipts@example.invalid',
      GIT_COMMITTER_NAME: 'Live proof receipts', GIT_COMMITTER_EMAIL: 'receipts@example.invalid' };
    const blob = git(directory, ['hash-object', '-w', '--stdin'], { env: indexEnv, input: body }).text;
    for (let attempt = 0; attempt < 5; attempt++) {
      git(directory, ['fetch', '--no-tags', remote, '+refs/heads/main:refs/receipt/main'], { env: indexEnv });
      const parent = git(directory, ['rev-parse', 'refs/receipt/main'], { env: indexEnv }).text;
      if (git(directory, ['ls-tree', parent, '--', path], { env: indexEnv }).text)
        throw new Error('receipt-already-exists');
      // Reject existing files/symlinks at each parent rather than replacing them.
      const pieces = path.split('/');
      for (let i = 1; i < pieces.length; i++) {
        const entry = git(directory, ['ls-tree', parent, '--', pieces.slice(0, i).join('/')], { env: indexEnv }).text;
        if (entry && !entry.startsWith('040000 tree ')) throw new Error('receipt-path-conflict');
      }
      git(directory, ['read-tree', parent], { env: indexEnv });
      git(directory, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env: indexEnv });
      const tree = git(directory, ['write-tree'], { env: indexEnv }).text;
      const commit = git(directory, ['commit-tree', tree, '-p', parent], {
        env: indexEnv, input: `Record ${receipt.workflow} ${receipt.runId}/${receipt.runAttempt}\n` }).text;
      if (git(directory, ['push', remote, `${commit}:refs/heads/main`], { env: indexEnv, allowFailure: true }).ok)
        return path;
      // Retry only a concurrent append, never force push, overwrite, or silently
      // downgrade to an artifact. Auth/network/hook failure fails immediately.
      const current = git(directory, ['ls-remote', '--refs', remote, 'refs/heads/main'], { env: indexEnv }).text.split(/\s/)[0];
      if (current === parent) throw new Error('receipt-push-failed');
    }
    throw new Error('receipt-concurrency-exhausted');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
