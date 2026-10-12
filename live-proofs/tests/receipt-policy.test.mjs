import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evidenceRepository } from '../policy.mjs';

test('receipt storage requires an explicit credential-free GitHub repository', () => {
  const url = 'https://github.com/just-every/happytohelp.git';
  assert.equal(evidenceRepository(url), url);
  for (const value of [undefined, '', '/local/store', 'file:///local/store',
    url.replace('https://','https://test-only-user:test-only-password@'),
    'https://elsewhere.example/example/receipts.git', `${url}?token=test`,
    `${url}\n`, url.replace('/happytohelp.git','/../happytohelp.git')]) {
    assert.throws(() => evidenceRepository(value), /receipt-store-unconfigured/);
  }
});

test('receipt destination comes only from protected Environment policy in the writer job', () => {
  for (const name of ['deploy-stage', 'live-proof']) {
    const workflow = readFileSync(`.github/workflows/${name}.yml`, 'utf8');
    const [before, receipt] = workflow.split('  receipt:\n');
    assert.doesNotMatch(before, /H2H_EVIDENCE_REPOSITORY/);
    assert.match(receipt, /H2H_EVIDENCE_REPOSITORY: \$\{\{ vars\.H2H_EVIDENCE_REPOSITORY \}\}/);
    assert.doesNotMatch(receipt, /inputs\..*(?:repository|remote)|needs\.prepare\.outputs/);
  }
});
