import { makeReceipt } from './receipt.mjs';
import { persistToGit } from './git-store.mjs';
import { readAuthEnv } from './git.mjs';
import { evidenceRepository } from './policy.mjs';
try {
  if (!process.env.EVIDENCE_WRITE_TOKEN?.trim()) throw new Error('missing-store-credential');
  const receipt = makeReceipt(process.env);
  persistToGit(receipt, { remote: evidenceRepository, tempRoot: process.env.RUNNER_TEMP,
    env: readAuthEnv(process.env.EVIDENCE_WRITE_TOKEN) });
  console.log('EVIDENCE_WRITE_TOKEN');
  if (receipt.result !== 'passed') process.exitCode = 1;
} catch { console.error('Receipt persistence failed.'); process.exitCode = 1; }
