export class ConnectorError extends Error {
  constructor(message, { code = 'CONNECTOR_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'ConnectorError';
    this.code = code;
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
