import { chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { uuid } from './util.mjs';
import { ConnectorError } from './errors.mjs';

export function configPath(environment = process.env) {
  if (environment.H2H_LOCAL_CONFIG) return environment.H2H_LOCAL_CONFIG;
  const root = environment.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(root, 'happytohelp', 'local-agent.json');
}

export async function readConfig(path = configPath()) {
  let raw;
  try {
    const info = await stat(path);
    if ((info.mode & 0o077) !== 0) {
      throw new ConnectorError(`Refusing to read insecure connector credential file: ${path}`, {
        code: 'INSECURE_CONFIG',
      });
    }
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ConnectorError(`No local connector is configured. Run h2h-local connect first.`, {
        code: 'CONFIG_MISSING',
      });
    }
    throw error;
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (cause) {
    throw new ConnectorError(`Connector configuration is not valid JSON: ${path}`, { code: 'CONFIG_INVALID', cause });
  }
  validateConfig(config);
  normalizeConfig(config);
  return config;
}

export async function writeConfig(config, path = configPath()) {
  validateConfig(config);
  const folder = dirname(path);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const temporary = join(folder, `.local-agent.${uuid()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function forgetConfig(path = configPath()) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export async function acquireConfigLock(path = configPath()) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const lock = `${path}.lock`;
  const owner = uuid();
  const create = async () => {
    const handle = await open(lock, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ owner, pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
  };
  try {
    await create();
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    let holder = null;
    try {
      holder = JSON.parse(await readFile(lock, 'utf8'));
    } catch {
      throw new ConnectorError(`Connector lock is unreadable: ${lock}. Remove it only after confirming no connector is running.`, {
        code: 'LOCKED',
      });
    }
    let live = Boolean(holder?.pid);
    if (live) {
      try {
        process.kill(holder.pid, 0);
      } catch (probeError) {
        live = probeError.code !== 'ESRCH';
      }
    }
    if (live) {
      throw new ConnectorError('Another h2h-local process owns this connector. Stop it before starting a second runner or MCP server.', {
        code: 'LOCKED',
      });
    }
    await unlink(lock);
    try {
      await create();
    } catch (retryError) {
      throw new ConnectorError('Another h2h-local process acquired this connector while recovering a stale lock.', {
        code: 'LOCKED',
        cause: retryError,
      });
    }
  }
  return {
    async release() {
      try {
        const current = JSON.parse(await readFile(lock, 'utf8'));
        if (current.owner === owner) await unlink(lock);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    },
  };
}

export function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ConnectorError('Connector configuration must be an object.', { code: 'CONFIG_INVALID' });
  }
  if (config.version !== 1 || typeof config.server !== 'string' || typeof config.token !== 'string') {
    throw new ConnectorError('Connector configuration is missing its server or device token.', { code: 'CONFIG_INVALID' });
  }
  if (!['codex', 'claude'].includes(config.provider)) {
    throw new ConnectorError('Connector configuration has an unsupported provider.', { code: 'CONFIG_INVALID' });
  }
  if (!config.device || typeof config.device.id !== 'string') {
    throw new ConnectorError('Connector configuration is missing the paired device identity.', { code: 'CONFIG_INVALID' });
  }
}

export function normalizeConfig(config) {
  if (!config.activeJobs || typeof config.activeJobs !== 'object' || Array.isArray(config.activeJobs)) {
    config.activeJobs = {};
  }
  if (config.active?.jobId && !config.activeJobs[config.active.jobId]) {
    config.activeJobs[config.active.jobId] = config.active;
  }
  if (!config.pendingClaims || typeof config.pendingClaims !== 'object' || Array.isArray(config.pendingClaims)) {
    config.pendingClaims = {};
  }
  if (!Array.isArray(config.terminalResultReceipts)) {
    config.terminalResultReceipts = [];
  }
  syncLegacyActive(config);
  return config;
}

export function syncLegacyActive(config) {
  const active = Object.values(config.activeJobs || {});
  config.active = active.length === 1 ? active[0] : null;
}

export function newConfig({ server, token, device, provider, name, workingDirectory, browserMcp, model }) {
  return {
    version: 1,
    server,
    token,
    device,
    provider,
    name,
    model: model || null,
    workingDirectory,
    browserMcp: browserMcp || null,
    browserHealth: null,
    pendingClaim: null,
    active: null,
    pendingClaims: {},
    activeJobs: {},
    terminalResultReceipts: [],
    seenInputIds: [],
  };
}
