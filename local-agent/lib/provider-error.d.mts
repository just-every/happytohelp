export type ProviderError = { provider: 'codex' | 'claude'; http_status: number | null; message: string };
export const MAX_PROVIDER_MESSAGE: number;
export function redactDiagnostic(value: unknown, maximum?: number): string;
export function normalizeProviderError(value: unknown): ProviderError | null;
export function providerFailureSummary(error: ProviderError): string;
