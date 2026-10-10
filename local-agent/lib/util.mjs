import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ConnectorError } from './errors.mjs';

export const MAX_PROGRESS_LENGTH = 800;
export const MAX_RUNTIME_OUTPUT = 1024 * 1024;

export function uuid() {
  return randomUUID();
}

export function boundedText(value, max = MAX_PROGRESS_LENGTH) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const normalized = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

export function isLoopbackHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || host === '127.0.0.1' || host.startsWith('127.');
}

export function assertServerUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConnectorError('Server must be an absolute HTTPS URL (or loopback HTTP for local testing).', {
      code: 'INVALID_SERVER_URL',
    });
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHostname(url.hostname))) {
    throw new ConnectorError('Server must use HTTPS. HTTP is allowed only for localhost test servers.', {
      code: 'INSECURE_SERVER_URL',
    });
  }
  if (url.username || url.password || url.hash) {
    throw new ConnectorError('Server URL must not include credentials or a fragment.', { code: 'INVALID_SERVER_URL' });
  }
  return url.toString().replace(/\/$/, '');
}

export function commandExists(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { stdio: 'ignore' });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
  });
}

export function waitForExit(child, timeoutMs = 3_000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    const finish = (result) => {
      clearTimeout(timer);
      child.removeListener('exit', exited);
      resolve(result);
    };
    const exited = (code, signal) => finish({ code, signal });
    const timer = setTimeout(() => finish(null), timeoutMs);
    child.once('exit', exited);
  });
}

export function stopChild(child, signal = 'SIGTERM') {
  if (child.exitCode === null && child.signalCode === null) child.kill(signal);
}

export function parseLastJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Structured-output runtimes may include a small amount of progress text.
  }

  for (let start = trimmed.lastIndexOf('{'); start >= 0; start = trimmed.lastIndexOf('{', start - 1)) {
    for (let end = trimmed.length; end > start; end -= 1) {
      if (trimmed[end - 1] !== '}') continue;
      try {
        return JSON.parse(trimmed.slice(start, end));
      } catch {
        // Keep looking for the final complete JSON object.
      }
    }
  }
  return null;
}

export function runtimeFailure(provider, reason) {
  throw new ConnectorError(`${provider} runtime failed: ${boundedText(reason, 600)}`, {
    code: 'RUNTIME_FAILED',
  });
}
