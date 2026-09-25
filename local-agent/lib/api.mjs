import { ApiError, ConnectorError } from './errors.mjs';
import { assertServerUrl } from './util.mjs';

export class LocalAgentApi {
  constructor({ server, token, fetchImpl = fetch }) {
    this.server = assertServerUrl(server);
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response;
    try {
      response = await this.fetchImpl(`${this.server}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch (cause) {
      throw new ApiError(`Unable to reach HappyToHelp server: ${cause.message}`, { cause });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (cause) {
        throw new ApiError('HappyToHelp server returned a non-JSON response.', { status: response.status, cause });
      }
    }
    if (!response.ok) {
      throw new ApiError(payload?.message || `HappyToHelp server rejected the request (${response.status}).`, {
        status: response.status,
      });
    }
    if (!payload || !Object.hasOwn(payload, 'data')) {
      throw new ConnectorError('HappyToHelp server response did not contain a data envelope.', {
        code: 'INVALID_API_RESPONSE',
      });
    }
    return payload.data;
  }

  pair(body) { return this.request('POST', '/api/local-agents/pair', body); }
  heartbeat(body) { return this.request('POST', '/api/local-agents/heartbeat', body); }
  claim(body) { return this.request('POST', '/api/local-agents/claim', body); }
  context(jobId, runId) {
    return this.request('GET', `/api/local-agents/jobs/${encodeURIComponent(jobId)}/context?run_id=${encodeURIComponent(runId)}`);
  }
  progress(jobId, body) { return this.request('POST', `/api/local-agents/jobs/${encodeURIComponent(jobId)}/progress`, body); }
  result(jobId, body) { return this.request('POST', `/api/local-agents/jobs/${encodeURIComponent(jobId)}/result`, body); }
  async upload(jobId, runId, screenshot) {
    const form = new FormData();
    form.append('run_id', runId);
    form.append('file', new Blob([screenshot.data], { type: screenshot.type }), screenshot.filename);
    return this.request('POST', `/api/local-agents/jobs/${encodeURIComponent(jobId)}/attachments`, form);
  }
}
