import { normalizeProviderError } from '../provider-error.mjs';

// stream-json exposes API retry status explicitly; assistant API failures can
// also carry a category without a status. Never infer HTTP from that category.
export function claudeProviderError(event) {
  if (event?.type === 'system' && event.subtype === 'api_retry') {
    return normalizeProviderError({ provider: 'claude', http_status: event.error_status ?? null,
      message: typeof event.error === 'string' ? event.error : 'The model provider request failed.' });
  }
  if (event?.type === 'assistant' && ['authentication_failed', 'billing_error', 'rate_limit', 'invalid_request', 'server_error', 'unknown'].includes(event.error)) {
    const message = (event.message?.content || []).filter(item => item.type === 'text' && typeof item.text === 'string').map(item => item.text).join(' ');
    return normalizeProviderError({ provider: 'claude', http_status: null, message });
  }
  return null;
}
