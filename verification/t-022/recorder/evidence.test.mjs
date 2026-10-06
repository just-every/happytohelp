import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceipt } from './evidence.mjs';
import { loadConfig, milestones } from './config.mjs';

const config = { origin: 'https://unit-test.invalid', sourceSha: 'a'.repeat(40) };
const base = { origin: config.origin, observedAt: '2026-10-06T00:00:00.000Z', projectId: 'project-test' };
const row = (kind, receipt) => ({ kind, data: { receipt } });
const owner = row('owner-setup', { projectId: base.projectId });
const ids = ['owner_mail', 'sender_dns', 'inbound_address', 'model_key', 'spend_ceilings', 'published_article', 'widget_origin', 'widget_seen'];

test('mail acceptance and reused/nonempty storage do not qualify', () => {
  const mail = { ...base, provider: 'test-only', messageId: 'mail', deliveryEventId: 'event', deliveryStatus: 'accepted' };
  assert.throws(() => validateReceipt('owner-mail-delivered', mail, config, [owner]), /not delivery/);
  const resources = { worker: 'new', d1: 'new-db', r2: 'new-bucket', queues: ['new-queue'] };
  const storage = { ...base, ...resources, inspectionMethod: 'test only', counts: { owners: 1, articles: 0, conversations: 0, activationReceipts: 0, setupSuccesses: 0 } };
  assert.throws(() => validateReceipt('fresh-storage', storage, config, [row('deployment', resources)]), /contains owners/);
  assert.throws(() => validateReceipt('owner-setup', { ...base, ownerPerformed: true }, config, []), /after fresh/);
});

test('empty checklist needs all eight distinct initial observations in owner project', () => {
  const receipt = { ...base, done: 0, total: 8, steps: ids.map(id => ({ id, state: 'not_checked' })), conversationCount: 0 };
  validateReceipt('empty-checklist', receipt, config, [owner]);
  assert.throws(() => validateReceipt('empty-checklist', { ...receipt, projectId: 'other' }, config, [owner]), /another project/);
  assert.throws(() => validateReceipt('empty-checklist', { ...receipt, steps: Array(8).fill(receipt.steps[0]) }, config, [owner]), /distinct/);
});

test('first answer must follow setup evidence and cite this run article in this conversation', () => {
  const receipts = milestones.slice(0, milestones.indexOf('first-cited-answer')).map(kind => row(kind, { ...base }));
  receipts.find(r => r.kind === 'visitor-question').data.receipt.conversationId = 'conversation-test';
  Object.assign(receipts.find(r => r.kind === 'published-article').data.receipt, { articleId: 'article-test', url: `${config.origin}/help/article-test` });
  const answer = { ...base, conversationId: 'conversation-test', messageId: 'answer-test', articleId: 'article-test', requestId: 'request-test', generationId: 'generation-test', citationUrl: `${config.origin}/help/article-test`, text: 'Synthetic evidence structure in a unit test only.' };
  validateReceipt('first-cited-answer', answer, config, receipts);
  assert.throws(() => validateReceipt('first-cited-answer', answer, config, receipts.filter(r => r.kind !== 'owner-mail-delivered')), /record owner-mail-delivered/);
  assert.throws(() => validateReceipt('first-cited-answer', { ...answer, articleId: 'old' }, config, receipts), /newly published/);
  assert.throws(() => validateReceipt('operator-transcript', { ...answer, text: 'different' }, config, [owner, row('first-cited-answer', answer)]), /differs/);
});

test('unknown cost cannot silently become zero and usage must join actual generation', () => {
  const answer = { requestId: 'request-test', generationId: 'generation-test' };
  const usage = { ...base, ...answer, rawUsage: { tokens: 17 }, costUsd: 'unknown', costStatus: 'unknown', rootSpendReceipt: 'root-pending-reconciliation' };
  const records = [owner, row('first-cited-answer', answer)];
  validateReceipt('model-usage', usage, config, records);
  assert.throws(() => validateReceipt('model-usage', { ...usage, costUsd: 0 }, config, records), /Unknown cost/);
  assert.throws(() => validateReceipt('model-usage', { ...usage, generationId: 'other' }, config, records), /actual generation/);
});

test('missing config is refused without running or fabricating a prerequisite', () => {
  assert.throws(() => loadConfig('/nonexistent/t022-recording-unit-test.json'), /ENOENT/);
});
