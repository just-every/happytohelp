// Shared by the connector and the native admission boundary. Never retain raw
// provider responses, request bodies, additionalDetails, or stderr as evidence.
export const MAX_PROVIDER_MESSAGE = 600;

export function redactDiagnostic(value, maximum = MAX_PROVIDER_MESSAGE) {
  if (typeof value !== 'string') return 'Provider request failed.';
  // Redact before bounding: truncation must never expose a partial credential.
  const text = value
    .replace(/\b(?:request[ _-]?(?:body|headers)|assignment|prompt|input|messages|sensitive[ _-]?context)\s*["']?\s*[:=][\s\S]*/gi, '[private context removed]')
    .replace(/https?:\/\/[^\s<>"']+/gi, raw => {
      try { const url = new URL(raw); return `${url.protocol}//${url.host}${url.pathname}`; }
      catch { return '[URL removed]'; }
    })
    .replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*["']?\s*[:=][^\r\n]*/gi, '[credentials removed]')
    .replace(/\b(?:bearer|basic)\s+[^\s,"'};]+/gi, '[credential removed]')
    .replace(/\b(?:[\w-]*(?:api[ _-]?key|token|secret|password|credential)[\w-]*)\s*["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, '[credential removed]')
    .replace(/\b(?:api[ _-]?key|password|access[ _-]?token|refresh[ _-]?token)\b[^\r\n]*/gi, '[credential removed]')
    .replace(/\b(?:sk-|sess-|gh[pousr]_|github_pat_)[a-zA-Z0-9_-]+/g, '[credential removed]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?/g, '[credential removed]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text || 'Provider request failed.';
}

export function normalizeProviderError(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['codex', 'claude'].includes(value.provider)
    || !(value.http_status === null || (Number.isInteger(value.http_status) && value.http_status >= 100 && value.http_status <= 599))
    || typeof value.message !== 'string') return null;
  return { provider: value.provider, http_status: value.http_status, message: redactDiagnostic(value.message) };
}

export function providerFailureSummary(error) {
  const provider = error.provider === 'codex' ? 'Codex' : 'Claude';
  return `${provider} could not complete this task because its model provider rejected or failed the request${error.http_status === null ? '' : ` (HTTP ${error.http_status})`}. Review the error before starting another task.`;
}
