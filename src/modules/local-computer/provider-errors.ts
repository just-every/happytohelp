import { normalizeProviderError, providerFailureSummary, redactDiagnostic } from '../../../local-agent/lib/provider-error.mjs';
import { requireValue, text } from './contracts';

// A connector is an untrusted writer. Rebuild failure evidence from a bounded,
// redacted allowlist so echoed prompts or credentials cannot reach D1 or the UI
// through summary, extra properties, actions, or proposed replies.
export function admitFailureResult(result: any, status: string, cancellationRequested = false) {
  if (!result || !Object.hasOwn(result, 'provider_error')) {
    if (!['failed', 'cancelled'].includes(status) && !cancellationRequested) return result;
    requireValue(result && typeof result === 'object' && !Array.isArray(result), 'Result required');
    text(result.summary);
    requireValue(typeof result.verified === 'boolean' && Array.isArray(result.actions) && result.actions.length <= 100, 'Invalid performed-work evidence');
    const actions = result.actions.map((action: any) => {
      requireValue(action && typeof action === 'object' && !Array.isArray(action), 'Invalid performed-work evidence');
      return { description: redactDiagnostic(text(action.description), 8000), evidence: redactDiagnostic(text(action.evidence), 8000) };
    });
    // Retain bounded partial-work evidence, but no runnable proposals, reply
    // drafts or arbitrary diagnostic fields. Attachment ownership is checked by
    // the normal result admission after this projection.
    return { summary: redactDiagnostic(result.summary, 8000), actions, verified: false, reply_draft: '',
      ...(Object.hasOwn(result, 'attachment_ids') ? { attachment_ids: result.attachment_ids } : {}) };
  }
  const error = result.provider_error;
  requireValue(status === 'failed' && result.verified === false, 'Provider errors require a failed, unverified result');
  requireValue(error && typeof error === 'object' && !Array.isArray(error)
    && Object.keys(error).every(key => ['provider', 'http_status', 'message'].includes(key))
    && typeof error.message === 'string' && error.message.length <= 8000, 'Invalid provider error');
  const safe = normalizeProviderError(error);
  requireValue(safe, 'Invalid provider error');
  return { summary: providerFailureSummary(safe), actions: [], reply_draft: '', verified: false, provider_error: safe };
}
