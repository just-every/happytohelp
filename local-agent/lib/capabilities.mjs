import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { commandExists, waitForExit } from './util.mjs';
import { ConnectorError } from './errors.mjs';

const BROWSER_PROBE_TTL_MS = 5 * 60 * 1000;
const CODEX_AUTH_TTL_MS = 5 * 60 * 1000;
const MAX_MCP_FRAME_LENGTH = 1024 * 1024;

function codexAuthIsFresh(auth, now = Date.now()) {
  return typeof auth?.authenticated === 'boolean' && auth.checkedAt
    && Date.parse(auth.checkedAt) + CODEX_AUTH_TTL_MS > now;
}

export async function codexLoginStatus({ spawnImpl = spawn, timeoutMs = 5_000 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let output = '';
    let child;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };
    const timer = setTimeout(() => {
      child?.kill('SIGTERM');
      finish({ authenticated: false, reason: 'Could not confirm Codex login status.' });
    }, timeoutMs);
    try {
      child = spawnImpl('codex', ['login', 'status'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch {
      finish({ authenticated: false, reason: 'Could not confirm Codex login status.' });
      return;
    }
    child.once('error', () => finish({ authenticated: false, reason: 'Could not confirm Codex login status.' }));
    const appendOutput = (chunk) => { output = `${output}${chunk.toString('utf8')}`.slice(-1_000); };
    child.stdout?.on('data', appendOutput);
    child.stderr?.on('data', appendOutput);
    child.once('close', (code) => {
      if (code === 0 && /logged in/i.test(output)) return finish({ authenticated: true });
      return finish({
        authenticated: false,
        reason: 'Codex is not signed in. Run `codex login`, then start the local agent again.',
      });
    });
  });
}

export function validateBrowserMcp(browserMcp) {
  if (browserMcp === null || browserMcp === undefined) return null;
  if (!browserMcp || typeof browserMcp !== 'object' || Array.isArray(browserMcp)) {
    throw new ConnectorError('Browser MCP configuration must be an object.', { code: 'BROWSER_CONFIG_INVALID' });
  }
  if (typeof browserMcp.command !== 'string' || !browserMcp.command.trim()) {
    throw new ConnectorError('Browser MCP configuration requires a command.', { code: 'BROWSER_CONFIG_INVALID' });
  }
  if (!Array.isArray(browserMcp.args) || browserMcp.args.some((arg) => typeof arg !== 'string')) {
    throw new ConnectorError('Browser MCP configuration requires an args array of strings.', {
      code: 'BROWSER_CONFIG_INVALID',
    });
  }
  if (!browserMcp.profileDir || typeof browserMcp.profileDir !== 'string' || !isAbsolute(browserMcp.profileDir)) {
    throw new ConnectorError('Browser MCP configuration requires an absolute dedicated profileDir.', {
      code: 'BROWSER_CONFIG_INVALID',
    });
  }
  if (!browserMcp.args.some((arg) => arg.includes(browserMcp.profileDir))) {
    throw new ConnectorError('Browser MCP args must pass the dedicated profileDir to the browser server.', {
      code: 'BROWSER_CONFIG_INVALID',
    });
  }
  return {
    command: browserMcp.command,
    args: [...browserMcp.args],
    profileDir: browserMcp.profileDir,
  };
}

export async function probeBrowserMcp(browserMcp, { timeoutMs = 10_000 } = {}) {
  const configured = validateBrowserMcp(browserMcp);
  if (!configured) return { configured: false, healthy: false, checkedAt: new Date().toISOString() };

  const child = spawn(configured.command, configured.args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  let received = '';
  let probeError = '';
  let settled = false;
  const append = (target, chunk) => `${target}${chunk.toString('utf8')}`.slice(-4_000);
  child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });

  const healthy = await new Promise((resolve) => {
    const timer = setTimeout(() => finish(false), timeoutMs);
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    child.once('error', () => finish(false));
    child.once('exit', () => finish(false));
    child.stdout.on('data', (chunk) => {
      received += chunk.toString('utf8');
      if (received.length > MAX_MCP_FRAME_LENGTH) {
        probeError = 'Browser MCP emitted an oversized JSONL frame during tools/list.';
        finish(false);
        return;
      }
      const lines = received.split('\n');
      received = lines.pop() || '';
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.id === 1 && message.result) {
            child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
            child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
          }
          if (message.id === 2 && message.result) {
            const browserTools = message.result.tools?.filter((tool) => typeof tool?.name === 'string'
              && tool.name.startsWith('browser_')) || [];
            if (browserTools.length) finish(true);
            else {
              probeError = 'Browser MCP initialized but did not expose browser_* tools.';
              finish(false);
            }
          }
        } catch {
          // An MCP server must send JSONL; non-JSON diagnostic output is ignored.
        }
      }
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'happytohelp-local-agent', version: '0.2.1' },
      },
    })}\n`);
  });
  child.kill('SIGTERM');
  await waitForExit(child, 1_000);
  return {
    configured: true,
    healthy,
    checkedAt: new Date().toISOString(),
    ...(healthy ? {} : { error: probeError || stderr || 'Browser MCP did not complete initialize and tools/list.' }),
  };
}

export function browserHealthIsFresh(health, now = Date.now()) {
  return Boolean(health?.configured && health?.healthy && health?.checkedAt
    && Date.parse(health.checkedAt) + BROWSER_PROBE_TTL_MS > now);
}

export async function runtimeCapabilities(config, {
  forceBrowserProbe = false,
  forceCodexLoginCheck = false,
  commandExistsFn = commandExists,
  codexLoginStatusFn = codexLoginStatus,
} = {}) {
  const capabilities = ['mcp'];
  const providerAvailable = await commandExistsFn(config.provider);
  const details = {
    provider: config.provider,
    providerAvailable,
    directRunnerAvailable: providerAvailable,
    browser: config.browserHealth || null,
  };

  if (config.provider === 'codex' && providerAvailable) {
    const login = !forceCodexLoginCheck && codexAuthIsFresh(config.codexAuth)
      ? config.codexAuth
      : { ...await codexLoginStatusFn(), checkedAt: new Date().toISOString() };
    config.codexAuth = login;
    details.codexAuthenticated = login.authenticated;
    if (!login.authenticated) {
      details.directRunnerAvailable = false;
      details.directRunnerReason = login.reason || 'Codex is not signed in. Run `codex login`, then start the local agent again.';
    }
  }
  if (config.provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
    details.directRunnerAvailable = false;
    details.directRunnerReason = 'ANTHROPIC_API_KEY is required for the standalone Claude runner.';
  }
  capabilities.push(`runtime:${config.provider}`);

  if (forceBrowserProbe || !browserHealthIsFresh(config.browserHealth)) {
    details.browser = await probeBrowserMcp(config.browserMcp);
  }
  if (details.browser?.configured && details.browser.healthy) {
    capabilities.push('browser_mcp');
  } else if (details.browser?.configured) {
    details.directRunnerAvailable = false;
    details.directRunnerReason = 'Configured browser MCP is unhealthy; direct runner will not fall back without it.';
  }
  if (details.directRunnerAvailable) capabilities.push('direct_runner');
  return { capabilities, details };
}

export function browserMcpForRuntime(browserMcp) {
  const configured = validateBrowserMcp(browserMcp);
  if (!configured) return null;
  return {
    command: configured.command,
    args: configured.args,
  };
}
