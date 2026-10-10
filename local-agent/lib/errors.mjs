import { normalizeProviderError } from './provider-error.mjs';

export class ConnectorError extends Error {
  constructor(message, { code = 'CONNECTOR_ERROR', cause, providerError } = {}) {
    super(message, { cause });
    this.name = 'ConnectorError';
    this.code = code;
    const provider = normalizeProviderError(providerError);
    if (provider) this.provider_error = provider;
  }
}

export class ApiError extends ConnectorError {
  constructor(message, { status, cause } = {}) {
    super(message, { code: 'API_ERROR', cause });
    this.name = 'ApiError';
    this.status = status;
  }
}

export function userMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
