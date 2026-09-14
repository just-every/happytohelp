#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acquireConfigLock, configPath, forgetConfig, readConfig } from '../lib/config.mjs';
import { ConnectorError } from '../lib/errors.mjs';
import { serveMcp } from '../lib/mcp.mjs';
import { LocalRunner } from '../lib/runner.mjs';
import { PAIRING_OPTION_NAMES, configurationForStart, connect } from '../lib/setup.mjs';
import { connectedMessage, friendlyError, readyMessage, statusMessage, writeLine } from '../lib/terminal.mjs';

export function usage() {
  return `HappyToHelp local agent

  h2h-local start [--server URL --code CODE --name NAME] [--provider codex|claude]
  h2h-local status

Advanced commands:
  h2h-local connect --server URL --code CODE --provider codex|claude --name NAME
  h2h-local run [--once]
  h2h-local mcp
  h2h-local disconnect

start pairs this config location when it has no pairing, then keeps a direct worker
running. It defaults to Codex. Set H2H_LOCAL_CONFIG to keep a separate pairing for
another HappyToHelp workspace.`;
}

export function parseArguments(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const [name, inline] = token.slice(2).split('=', 2);
    if (name === 'once' || name === 'help') {
      options[name] = true;
      continue;
    }
    const value = inline ?? argv[index + 1];
    if (value === undefined || (value.startsWith('--') && name !== 'browser-arg')) {
      throw new ConnectorError(`--${name} requires a value.`, { code: 'ARGUMENT_ERROR' });
    }
    if (inline === undefined) index += 1;
    if (name === 'browser-arg') {
      options[name] ||= [];
      options[name].push(value);
    } else {
      if (options[name] !== undefined) throw new ConnectorError(`--${name} may be specified only once.`, { code: 'ARGUMENT_ERROR' });
      options[name] = value;
    }
  }
  return { command: positionals[0], positionals: positionals.slice(1), options };
}

function assertOnly(options, allowed, command) {
  for (const option of Object.keys(options)) {
    if (!allowed.has(option)) {
      throw new ConnectorError(`${command} does not accept --${option}.`, { code: 'ARGUMENT_ERROR' });
    }
  }
}

function abortOnSignals() {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Interrupted by the local operator.'));
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  return {
    signal: controller.signal,
    detach: () => {
      process.removeListener('SIGINT', abort);
      process.removeListener('SIGTERM', abort);
    },
  };
}

async function runWorker(runner, config, { once = false } = {}) {
  const signals = abortOnSignals();
  try {
    await runner.run({
      once,
      signal: signals.signal,
      onReady: () => writeLine(readyMessage(config)),
    });
  } finally {
    signals.detach();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { command, positionals, options } = parseArguments(argv);
  if (!command || options.help || command === 'help') {
    writeLine(usage());
    return;
  }
  if (positionals.length) throw new ConnectorError(`Unexpected argument: ${positionals[0]}`, { code: 'ARGUMENT_ERROR' });
  const path = configPath();
  const lock = await acquireConfigLock(path);
  try {
    if (command === 'connect') {
      assertOnly(options, PAIRING_OPTION_NAMES, 'connect');
      const { config } = await connect(options, path);
      writeLine(connectedMessage(config));
      writeLine('Run the dashboard restart command to connect and listen for assignments.');
      return;
    }
    if (command === 'disconnect') {
      assertOnly(options, new Set(), 'disconnect');
      await forgetConfig(path);
      writeLine('Disconnected this local pairing. Revoke the device in HappyToHelp when it should no longer be eligible for assignments.');
      return;
    }
    if (command === 'start') {
      assertOnly(options, new Set([...PAIRING_OPTION_NAMES, 'once']), 'start');
      const { config, pairedNow } = await configurationForStart(options, path);
      if (pairedNow) writeLine(connectedMessage(config));
      const runner = new LocalRunner(config, { configPath: path, log: (message) => writeLine(message, process.stderr) });
      await runWorker(runner, config, { once: options.once });
      return;
    }
    const config = await readConfig(path);
    const runner = new LocalRunner(config, { configPath: path, log: (message) => writeLine(message, process.stderr) });
    if (command === 'status') {
      assertOnly(options, new Set(), 'status');
      writeLine(statusMessage(await runner.status()));
      return;
    }
    if (command === 'mcp') {
      assertOnly(options, new Set(), 'mcp');
      writeLine('HappyToHelp MCP bridge started. In the desktop session, call h2h_wait_for_assignment to begin watching for work.', process.stderr);
      try {
        await serveMcp(runner);
      } finally {
        await runner.mcpStopped();
      }
      return;
    }
    if (command === 'run') {
      assertOnly(options, new Set(['once']), 'run');
      await runWorker(runner, config, { once: options.once });
      return;
    }
    throw new ConnectorError(`Unknown command: ${command}`, { code: 'ARGUMENT_ERROR' });
  } finally {
    await lock.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    writeLine(`HappyToHelp local agent: ${friendlyError(error)}`, process.stderr);
    process.exitCode = 1;
  });
}
