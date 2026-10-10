import { normalizeProviderError } from '../provider-error.mjs';

// Some installed Codex versions forward the provider's JSON error envelope as
// message with codexErrorInfo: 'other'. Only extract a recognized error body;
// arbitrary runtime JSON and additionalDetails are not provider diagnostics.
function providerMessage(message) {
  if (typeof message !== 'string' || message.length > 64_000) return null;
  try {
    const error = JSON.parse(message)?.error;
    if (error && typeof error.message === 'string'
      && ['invalid_request_error', 'authentication_error', 'permission_error', 'rate_limit_error', 'server_error', 'api_error', 'overloaded_error'].includes(error.type)) return error.message;
  } catch { /* Plain native error messages are handled below. */ }
  return null;
}

// These are native CodexErrorInfo variants. A code such as badRequest does not
// establish an HTTP status; only the explicit native status metadata does.
export function codexProviderError(error) {
  if (!error || typeof error !== 'object') return null;
  const info = error.codexErrorInfo;
  const connection = info && typeof info === 'object'
    ? info.httpConnectionFailed || info.responseStreamConnectionFailed || info.responseStreamDisconnected || info.responseTooManyFailedAttempts
    : null;
  const status = connection?.httpStatusCode ?? error.httpResponseStatusCode ?? null;
  const bodyMessage = providerMessage(error.message);
  const knownProvider = ['badRequest', 'unauthorized', 'usageLimitExceeded', 'serverOverloaded'].includes(info);
  if (!connection && status === null && !knownProvider && !(bodyMessage && (info == null || info === 'other'))) return null;
  return normalizeProviderError({ provider: 'codex', http_status: status, message: bodyMessage ?? error.message });
}
