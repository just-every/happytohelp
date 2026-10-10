import { ConnectorError } from './errors.mjs';
import { normalizeProviderError, providerFailureSummary, redactDiagnostic } from './provider-error.mjs';

const MAX_ACTIONS = 50;
const MAX_FIELD_LENGTH = 12_000;
const MAX_PROPOSALS = 20;

export const AGENT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['completed', 'needs_input'] },
    summary: { type: 'string' },
    actions: {
      type: 'array',
      maxItems: MAX_ACTIONS,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['description', 'evidence'],
      },
    },
    reply_draft: { type: 'string' },
    attachment_ids: { type: 'array', maxItems: 10, items: { type: 'string' } },
    replies: {
      type: 'array', maxItems: MAX_PROPOSALS,
      items: {
        type: 'object', additionalProperties: false,
        properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, attachment_ids: { type: 'array', maxItems: 10, items: { type: 'string' } } },
        required: ['id', 'title', 'body', 'attachment_ids'],
      },
    },
    follow_up_actions: {
      type: 'array', maxItems: MAX_PROPOSALS,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, instructions: { type: 'string' },
          mode: { type: 'string', enum: ['investigate', 'resolve', 'resolve_reply'] }, attachment_ids: { type: 'array', maxItems: 10, items: { type: 'string' } },
        },
        required: ['id', 'title', 'instructions', 'mode', 'attachment_ids'],
      },
    },
    verified: { type: 'boolean' },
    question: { type: ['string', 'null'] },
  },
  required: ['status', 'summary', 'actions', 'reply_draft', 'attachment_ids', 'replies', 'follow_up_actions', 'verified', 'question'],
};

function nonEmptyString(value, field, { required = true } = {}) {
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConnectorError(`Runtime result requires a non-empty ${field}.`, { code: 'INVALID_RESULT' });
  }
  if (value.length > MAX_FIELD_LENGTH) {
    throw new ConnectorError(`Runtime result ${field} exceeds the allowed size.`, { code: 'INVALID_RESULT' });
  }
}

export function validateAgentOutput(output, { mode } = {}) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new ConnectorError('Runtime did not return a structured result object.', { code: 'INVALID_RESULT' });
  }
  const allowed = new Set(Object.keys(AGENT_OUTPUT_SCHEMA.properties));
  for (const key of Object.keys(output)) {
    if (!allowed.has(key)) throw new ConnectorError(`Runtime result contains unsupported field: ${key}`, { code: 'INVALID_RESULT' });
  }
  if (!['completed', 'needs_input'].includes(output.status)) {
    throw new ConnectorError('Runtime result status must be completed or needs_input.', { code: 'INVALID_RESULT' });
  }
  nonEmptyString(output.summary, 'summary');
  if (!Array.isArray(output.actions) || output.actions.length > MAX_ACTIONS) {
    throw new ConnectorError('Runtime result actions must be a bounded array.', { code: 'INVALID_RESULT' });
  }
  output.actions.forEach((action, index) => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      throw new ConnectorError(`Runtime result action ${index + 1} is invalid.`, { code: 'INVALID_RESULT' });
    }
    nonEmptyString(action.description, `actions[${index}].description`);
    nonEmptyString(action.evidence, `actions[${index}].evidence`);
  });
  if (output.reply_draft !== undefined && (typeof output.reply_draft !== 'string' || output.reply_draft.length > 8_000)) {
    throw new ConnectorError('Runtime result reply_draft must be a bounded string.', { code: 'INVALID_RESULT' });
  }
  validateProposals(output.replies, 'replies', (reply, index, seen) => {
    proposalId(reply, 'reply', index, seen);
    boundedString(reply.title, `replies[${index}].title`, 240, { allowEmpty: true });
    boundedString(reply.body, `replies[${index}].body`, 8_000, { allowEmpty: true });
  });
  validateProposals(output.follow_up_actions, 'follow_up_actions', (action, index, seen) => {
    proposalId(action, 'follow-up action', index, seen);
    boundedString(action.title, `follow_up_actions[${index}].title`, 240, { allowEmpty: true });
    boundedString(action.instructions, `follow_up_actions[${index}].instructions`, 12_000);
    if (!['investigate', 'resolve', 'resolve_reply'].includes(action.mode)) {
      throw new ConnectorError(`Runtime result follow_up_actions[${index}].mode is invalid.`, { code: 'INVALID_RESULT' });
    }
  });
  const attachmentIds = [];
  attachmentIds.push(...validateAttachmentIds(output.attachment_ids, 'attachment_ids'));
  (output.replies || []).forEach((reply, index) => {
    attachmentIds.push(...validateAttachmentIds(reply.attachment_ids, `replies[${index}].attachment_ids`));
  });
  (output.follow_up_actions || []).forEach((action, index) => {
    attachmentIds.push(...validateAttachmentIds(action.attachment_ids, `follow_up_actions[${index}].attachment_ids`));
  });
  if (new Set(attachmentIds).size > 30) {
    throw new ConnectorError('Runtime result may reference at most 30 distinct attachments.', { code: 'INVALID_RESULT' });
  }
  if (typeof output.verified !== 'boolean') {
    throw new ConnectorError('Runtime result verified must be a boolean.', { code: 'INVALID_RESULT' });
  }
  if (output.question !== null && output.question !== undefined) nonEmptyString(output.question, 'question');
  if (output.status === 'completed' && !output.verified) {
    throw new ConnectorError('Completed work must be verified.', { code: 'INVALID_RESULT' });
  }
  if (output.status === 'completed' && output.question !== null) {
    throw new ConnectorError('Completed work must set question to null.', { code: 'INVALID_RESULT' });
  }
  if (output.status === 'needs_input') {
    nonEmptyString(output.question, 'question');
    if (output.verified) throw new ConnectorError('needs_input work cannot be verified.', { code: 'INVALID_RESULT' });
  }
  return {
    status: output.status,
    result: {
      summary: output.summary,
      actions: output.actions.map((action) => ({ description: action.description, evidence: action.evidence })),
      ...(output.reply_draft !== undefined ? { reply_draft: output.reply_draft } : {}),
      ...(output.attachment_ids !== undefined ? { attachment_ids: output.attachment_ids } : {}),
      ...(output.replies !== undefined && !(mode === 'resolve_reply' && output.replies.length === 0) ? { replies: output.replies.map(({ id, title, body, attachment_ids }) => ({ id, title, body, ...(attachment_ids !== undefined ? { attachment_ids } : {}) })) } : {}),
      ...(output.follow_up_actions !== undefined ? { follow_up_actions: output.follow_up_actions.map(({ id, title, instructions, mode, attachment_ids }) => ({ id, title, instructions, mode, ...(attachment_ids !== undefined ? { attachment_ids } : {}) })) } : {}),
      verified: output.verified,
      ...(output.question ? { question: output.question } : {}),
    },
  };
}

function validateProposals(value, field, validate) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_PROPOSALS) {
    throw new ConnectorError(`Runtime result ${field} must be a bounded array.`, { code: 'INVALID_RESULT' });
  }
  const seen = new Set();
  value.forEach((proposal, index) => {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
      throw new ConnectorError(`Runtime result ${field}[${index}] is invalid.`, { code: 'INVALID_RESULT' });
    }
    validate(proposal, index, seen);
  });
}

function proposalId(proposal, label, index, seen) {
  if (typeof proposal.id !== 'string' || !proposal.id.trim() || proposal.id.length > 80 || seen.has(proposal.id)) {
    throw new ConnectorError(`Runtime result ${label} ${index + 1} needs a unique stable id.`, { code: 'INVALID_RESULT' });
  }
  seen.add(proposal.id);
}

function boundedString(value, field, maximum, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) {
    throw new ConnectorError(`Runtime result ${field} is invalid.`, { code: 'INVALID_RESULT' });
  }
}

function validateAttachmentIds(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10 || new Set(value).size !== value.length
    || value.some((id) => typeof id !== 'string' || !uuid(id))) {
    throw new ConnectorError(`Runtime result ${field} must contain at most 10 distinct attachment UUIDs.`, { code: 'INVALID_RESULT' });
  }
  return value;
}

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function failureResult(message, providerError) {
  const provider = normalizeProviderError(providerError);
  return {
    summary: provider ? providerFailureSummary(provider) : redactDiagnostic(message),
    ...(provider ? { provider_error: provider } : {}),
    actions: [],
    reply_draft: '',
    verified: false,
  };
}
