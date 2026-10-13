import { copyFileSync, constants, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { digest, invariant, LIMIT, safeText } from './custody.mjs';
import { milestones } from './config.mjs';

const fields = {
  deployment: ['sourceSha', 'workflowRunId', 'workflowAttempt', 'workflowUrl', 'deploymentVersion', 'buildSha256', 'worker', 'd1', 'r2', 'queues'],
  'fresh-storage': ['worker', 'd1', 'r2', 'queues', 'counts', 'inspectionMethod'],
  'owner-setup': ['projectId', 'ownerPerformed'],
  'empty-checklist': ['projectId', 'done', 'total', 'steps', 'conversationCount'],
  'sender-dns': ['projectId', 'provider', 'domain', 'providerStatus', 'records'],
  'owner-mail-delivered': ['projectId', 'provider', 'messageId', 'deliveryEventId', 'deliveryStatus'],
  'inbound-receipt': ['projectId', 'provider', 'challengeId', 'messageId', 'receiptId'],
  'model-key': ['projectId', 'provider', 'model', 'validationReceiptId'],
  'spend-ceilings': ['projectId', 'effectiveLimits', 'resetUtc', 'rootSpendReceipt'],
  'published-article': ['projectId', 'articleId', 'url', 'title', 'contentSha256', 'publishedAt'],
  'default-assistant': ['projectId', 'assistantId', 'model', 'enabled', 'isDefault'],
  'widget-origin': ['projectId', 'allowedOrigin'],
  'widget-installed': ['projectId', 'hostUrl', 'scriptUrl', 'scriptSha256'],
  'widget-ping': ['projectId', 'receiptId', 'contactId', 'widgetOrigin', 'eventType'],
  'visitor-question': ['projectId', 'conversationId', 'messageId', 'text'],
  'first-cited-answer': ['projectId', 'conversationId', 'messageId', 'articleId', 'requestId', 'generationId', 'citationUrl', 'text'],
  'operator-transcript': ['projectId', 'conversationId', 'messageId', 'articleId', 'citationUrl', 'text'],
  'citation-target': ['projectId', 'articleId', 'url', 'contentSha256', 'status'],
  'reload-survival': ['projectId', 'conversationId', 'messageId', 'articleId', 'citationUrl', 'text'],
  'model-usage': ['projectId', 'requestId', 'generationId', 'rawUsage', 'costUsd', 'costStatus', 'rootSpendReceipt'],
  'final-checklist': ['projectId', 'done', 'total', 'steps'],
};
export function validateReceipt(kind, receipt, config, records) {
  invariant(fields[kind], 'Unsupported receipt kind');
  invariant(receipt.origin === config.origin && Number.isFinite(Date.parse(receipt.observedAt)), 'Receipt needs installation origin and observedAt UTC');
  for (const key of fields[kind]) invariant(receipt[key] !== undefined && receipt[key] !== null && receipt[key] !== '', `${kind}: missing ${key}`);
  const prior = name => records.find(r => r.kind === name)?.data.receipt;
  const owner = prior('owner-setup');
  if (owner && receipt.projectId) invariant(receipt.projectId === owner.projectId, 'Receipt belongs to another project');
  if (kind === 'deployment') {
    invariant(receipt.sourceSha === config.sourceSha && /^[0-9a-f]{64}$/.test(receipt.buildSha256), 'Deployment source/build mismatch');
    invariant(/^https:\/\/github\.com\/just-every\/run-happytohelp\/actions\/runs\/\d+/.test(receipt.workflowUrl), 'Actual project workflow run URL required');
  }
  if (kind === 'fresh-storage') {
    const deployment = prior('deployment'); invariant(deployment, 'Deployment receipt must precede storage inspection');
    for (const key of ['worker', 'd1', 'r2', 'queues']) invariant(JSON.stringify(receipt[key]) === JSON.stringify(deployment[key]), 'Fresh resources differ from deployed resources');
    for (const key of ['owners', 'articles', 'conversations', 'activationReceipts', 'setupSuccesses']) invariant(receipt.counts[key] === 0, `Fresh storage contains ${key}`);
  }
  if (kind === 'owner-setup') invariant(prior('fresh-storage') && receipt.ownerPerformed === true, 'Owner must perform setup after fresh storage inspection');
  if (['empty-checklist', 'final-checklist'].includes(kind)) {
    const expected = ['owner_mail', 'sender_dns', 'inbound_address', 'model_key', 'spend_ceilings', 'published_article', 'widget_origin', 'widget_seen'];
    invariant(Array.isArray(receipt.steps) && receipt.steps.length === 8 && expected.every(id => receipt.steps.some(s => s.id === id)), 'Eight distinct activation step IDs required');
  }
  if (kind === 'empty-checklist') invariant(owner && receipt.done === 0 && receipt.total === 8 && receipt.steps.length === 8 && receipt.steps.every(s => s.state === 'not_checked') && receipt.conversationCount === 0, 'Initial empty owner inbox must show 0/8 not checked');
  if (kind === 'published-article') invariant(prior('empty-checklist'), 'Observe empty checklist before authoring');
  if (kind === 'owner-mail-delivered') invariant(receipt.deliveryStatus === 'delivered', 'Accepted or queued mail is not delivery');
  if (kind === 'default-assistant') invariant(receipt.enabled === true && receipt.isDefault === true, 'Selected default assistant must be enabled');
  if (kind === 'widget-ping') invariant(receipt.eventType === 'ping' && receipt.widgetOrigin === prior('widget-origin')?.allowedOrigin, 'Actual ping receipt required');
  if (kind === 'first-cited-answer') {
    for (const step of milestones.slice(0, milestones.indexOf('first-cited-answer'))) invariant(prior(step), `Before first answer, record ${step}`);
    invariant(prior('visitor-question')?.conversationId === receipt.conversationId, 'Answer must belong to recorded visitor question');
    invariant(prior('published-article')?.articleId === receipt.articleId && prior('published-article')?.url === receipt.citationUrl, 'First answer must cite newly published article');
  }
  if (['operator-transcript', 'reload-survival'].includes(kind)) {
    const answer = prior('first-cited-answer'); invariant(answer, 'First answer is missing');
    for (const key of ['conversationId', 'messageId', 'articleId', 'citationUrl', 'text']) invariant(receipt[key] === answer[key], `${kind}: differs from first cited answer`);
  }
  if (kind === 'citation-target') {
    const article = prior('published-article'); invariant(article && receipt.articleId === article.articleId && receipt.url === article.url && receipt.contentSha256 === article.contentSha256 && receipt.status === 200, 'Citation target differs from newly published content');
  }
  if (kind === 'model-usage') {
    const answer = prior('first-cited-answer'); invariant(answer && receipt.requestId === answer.requestId && receipt.generationId === answer.generationId, 'Usage must match actual generation');
    invariant(['known', 'unknown', 'partial'].includes(receipt.costStatus), 'Explicit known/unknown/partial cost status required');
    invariant(receipt.costStatus === 'known' ? Number.isFinite(receipt.costUsd) && receipt.costUsd >= 0 : receipt.costUsd === 'unknown', 'Unknown cost must not become zero');
  }
  if (kind === 'final-checklist') invariant(receipt.done === 8 && receipt.total === 8 && receipt.steps.length === 8 && receipt.steps.every(s => s.state === 'done'), 'Final checklist does not have eight observed successes');
}

export function importEvidence(input, config, directory, journal, records) {
  invariant(milestones.includes(input.kind) && !records.some(r => r.kind === input.kind), 'Unknown or already recorded milestone; failed observations belong in note events');
  invariant(typeof input.file === 'string' && statSync(input.file).isFile() && statSync(input.file).size < LIMIT, 'Evidence file missing or exceeds 50 MB');
  const bytes = readFileSync(input.file);
  let receipt;
  const image = input.kind.startsWith('capture-');
  if (image) invariant(extname(input.file).toLowerCase() === '.jpg' && bytes[0] === 0xff && bytes[1] === 0xd8, 'Capture must be actual JPG bytes');
  else {
    receipt = JSON.parse(safeText(bytes.toString()));
    validateReceipt(input.kind, receipt, config, records);
    const observed = Date.parse(receipt.observedAt), started = Date.parse(records[0].utc);
    invariant(observed >= started && observed <= Date.now() + 1000, 'Evidence observation is outside this running attempt');
  }
  const file = `receipts/${input.kind}${image ? '.jpg' : '.json'}`;
  copyFileSync(input.file, join(directory, file), constants.COPYFILE_EXCL);
  return journal.append(input.kind, { file, sha256: digest(bytes), bytes: bytes.length, ...(receipt ? { receipt } : {}) });
}
