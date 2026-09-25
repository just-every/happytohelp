import { isAbsolute, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { LocalAgentApi } from './api.mjs';
import { runtimeCapabilities, validateBrowserMcp } from './capabilities.mjs';
import { newConfig, readConfig, writeConfig } from './config.mjs';
import { ConnectorError } from './errors.mjs';
import { providerLabel } from './terminal.mjs';
import { assertServerUrl } from './util.mjs';

export const PAIRING_OPTION_NAMES = new Set([
  'server', 'code', 'provider', 'name', 'workdir', 'model',
  'browser-command', 'browser-arg', 'browser-profile',
]);

function requireOption(options, name) {
  if (!options[name]) throw new ConnectorError(`Pairing requires --${name}.`, { code: 'ARGUMENT_ERROR' });
  return options[name];
}

export function hasPairingOptions(options) {
  return Object.keys(options).some((option) => PAIRING_OPTION_NAMES.has(option));
}

function browserMcpFromOptions(options) {
  const present = ['browser-command', 'browser-arg', 'browser-profile'].some((name) => options[name] !== undefined);
  if (!present) return null;
  const profileDir = requireOption(options, 'browser-profile');
  if (!isAbsolute(profileDir)) throw new ConnectorError('--browser-profile must be an absolute path.', { code: 'ARGUMENT_ERROR' });
  return validateBrowserMcp({
    command: requireOption(options, 'browser-command'),
    args: options['browser-arg'] || [],
    profileDir,
  });
}

function workdirFromOptions(options) {
  const workdir = options.workdir ? resolve(options.workdir) : process.cwd();
  if (!existsSync(workdir)) throw new ConnectorError(`Working directory does not exist: ${workdir}`, { code: 'ARGUMENT_ERROR' });
  return workdir;
}

async function assertUnpairedConfig(path) {
  try {
    await readConfig(path);
  } catch (error) {
    if (error?.code === 'CONFIG_MISSING') return;
    throw error;
  }
  throw new ConnectorError('This config location is already paired. Run the dashboard restart command to resume it, or disconnect it before pairing a replacement. The existing credential and assignment state were left unchanged.', {
    code: 'ALREADY_PAIRED',
  });
}

export async function connect(options, path, { defaultProvider = null } = {}) {
  await assertUnpairedConfig(path);
  const provider = options.provider || defaultProvider;
  if (!['codex', 'claude'].includes(provider)) {
    throw new ConnectorError('--provider must be codex or claude.', { code: 'ARGUMENT_ERROR' });
  }
  const server = assertServerUrl(requireOption(options, 'server'));
  const browserMcp = browserMcpFromOptions(options);
  if (browserMcp) await mkdir(browserMcp.profileDir, { recursive: true, mode: 0o700 });
  const provisional = newConfig({
    server,
    token: 'unpaired',
    device: { id: 'unpaired' },
    provider,
    name: requireOption(options, 'name'),
    model: options.model,
    workingDirectory: workdirFromOptions(options),
    browserMcp,
  });
  const report = await runtimeCapabilities(provisional, { forceBrowserProbe: true });
  if (!report.details.providerAvailable) {
    throw new ConnectorError(`${providerLabel(provider)} is not installed or cannot run on this computer.`, { code: 'RUNTIME_UNAVAILABLE' });
  }
  if (provider === 'codex' && !report.details.codexAuthenticated) {
    throw new ConnectorError(report.details.directRunnerReason || 'Codex is not signed in. Run `codex login`, then run this setup command again.', {
      code: 'CODEX_LOGIN_REQUIRED',
    });
  }
  const api = new LocalAgentApi({ server });
  const paired = await api.pair({
    code: requireOption(options, 'code'),
    name: provisional.name,
    provider,
    capabilities: report.capabilities,
  });
  if (!paired || typeof paired.token !== 'string' || !paired.token || !paired.device?.id) {
    throw new ConnectorError('HappyToHelp did not return a valid paired device.', { code: 'INVALID_API_RESPONSE' });
  }
  const config = newConfig({ ...provisional, token: paired.token, device: paired.device });
  config.browserHealth = report.details.browser;
  if (report.details.codexAuthenticated !== undefined) config.codexAuth = provisional.codexAuth;
  if (typeof paired.pairing_id === 'string') config.pairingId = paired.pairing_id;
  await writeConfig(config, path);
  return { config, report };
}

export async function configurationForStart(options, path) {
  try {
    const config = await readConfig(path);
    if (hasPairingOptions(options)) {
      throw new ConnectorError('This config location is already paired. Run the dashboard restart command without pairing options to resume it, or disconnect it before pairing a replacement.', {
        code: 'ALREADY_PAIRED',
      });
    }
    return { config, pairedNow: false };
  } catch (error) {
    if (error?.code !== 'CONFIG_MISSING') throw error;
  }
  if (!hasPairingOptions(options)) {
    throw new ConnectorError('No pairing is stored here. Run the setup command from HappyToHelp, including --server, --code, and --name.', {
      code: 'CONFIG_MISSING',
    });
  }
  const { config } = await connect(options, path, { defaultProvider: 'codex' });
  return { config, pairedNow: true };
}
