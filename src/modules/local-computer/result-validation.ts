import { mode, requireValue, text } from './contracts';

// Validate the submitted structure before any terminal-failure projection.
// In particular, discarded proposals still carry attachment authority checks.
export function validateResult(result: any): string[] {
  requireValue(result && typeof result === 'object' && !Array.isArray(result), 'Result required');
  text(result.summary);
  requireValue(typeof result.verified === 'boolean' && Array.isArray(result.actions) && result.actions.length <= 100, 'Invalid performed-work evidence');
  for (const action of result.actions) {
    requireValue(action && typeof action === 'object' && !Array.isArray(action), 'Invalid performed-work evidence');
    text(action.description);
    text(action.evidence);
  }
  for (const key of ['replies', 'follow_up_actions']) if (Object.hasOwn(result, key)) {
    requireValue(Array.isArray(result[key]) && result[key].length <= 20, 'Invalid proposals');
    const seen = new Set();
    for (const proposal of result[key]) {
      requireValue(proposal && typeof proposal === 'object' && !Array.isArray(proposal), 'Invalid proposal');
      text(proposal.id, 100);
      requireValue(!seen.has(proposal.id), 'Duplicate proposal');
      seen.add(proposal.id);
      text(proposal.title, 300);
      if (key === 'replies') text(proposal.body);
      else { mode(proposal.mode); text(proposal.instructions); }
    }
  }
  const ids = new Set<string>();
  for (const value of [result, ...(result.replies || []), ...(result.follow_up_actions || [])]) {
    const attachments = value.attachment_ids || [];
    requireValue(Array.isArray(attachments) && attachments.length <= 10 && new Set(attachments).size === attachments.length, 'Invalid attachment list');
    for (const attachment of attachments) ids.add(text(attachment, 200));
  }
  requireValue(ids.size <= 30, 'Too many attachments');
  return [...ids];
}
