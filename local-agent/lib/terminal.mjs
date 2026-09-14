import { userMessage } from './errors.mjs';

export function providerLabel(provider) {
  return provider === 'codex' ? 'Codex' : 'Claude';
}

export function writeLine(message, stream = process.stdout) {
  stream.write(`${message}\n`);
}

export function connectedMessage(config) {
  return `Paired this computer with HappyToHelp using ${providerLabel(config.provider)}. Starting the local worker…`;
}

export function readyMessage(config) {
  return `Ready — ${providerLabel(config.provider)} is connected to HappyToHelp.\nListening for approved assignments. Keep this terminal open; press Ctrl+C to stop.`;
}

export function statusMessage(status) {
  const browser = !status.browser?.configured
    ? 'not configured'
    : (status.browser.healthy ? 'ready' : `needs attention${status.browser.error ? ` (${status.browser.error})` : ''}`);
  const direct = status.directRunnerAvailable
    ? 'ready'
    : `unavailable${status.directRunnerReason ? ` (${status.directRunnerReason})` : ''}`;
  const assignments = Array.isArray(status.activeJobs) ? status.activeJobs : (status.active ? [status.active] : []);
  const active = assignments.length
    ? `Saved assignments: ${assignments.map((job) => `${job.jobId} (${job.phase})`).join(', ')}.`
    : 'Saved assignments: none.';
  return [
    'HappyToHelp local agent',
    `Provider: ${providerLabel(status.provider)}${status.model ? ` (${status.model})` : ''}.`,
    `Direct runtime: ${direct}.`,
    `Browser MCP: ${browser}.`,
    active,
    'Worker: not checked by status. Use the dashboard restart command to connect and listen.',
  ].join('\n');
}

export function friendlyError(error) {
  const message = userMessage(error);
  if (error?.code === 'CONFIG_MISSING') {
    return 'No pairing is stored at this config location. Run the setup command from HappyToHelp.';
  }
  if (error?.code === 'LOCKED') {
    return `A local worker or MCP server is already using this pairing. ${message}`;
  }
  return message;
}
