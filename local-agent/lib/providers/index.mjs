import { runClaude } from './claude-cli.mjs';
import { runCodex } from './codex-app-server.mjs';
import { ConnectorError } from '../errors.mjs';

export function runProvider(provider, options) {
  if (provider === 'codex') return runCodex(options);
  if (provider === 'claude') return runClaude(options);
  throw new ConnectorError(`Unsupported provider: ${provider}`, { code: 'UNSUPPORTED_PROVIDER' });
}
