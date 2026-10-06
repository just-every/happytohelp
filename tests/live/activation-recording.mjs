#!/usr/bin/env node
// Real-run recorder only. This entry point never installs dependencies, launches
// a browser, enters credentials, creates an owner, or invents workflow inputs.
import { loadConfig } from '../../verification/t-022/recorder/config.mjs';
import { record } from '../../verification/t-022/recorder/session.mjs';
import { safeText } from '../../verification/t-022/recorder/custody.mjs';
import { inspect } from '../../verification/t-022/recorder/verify.mjs';

const [mode, path, ...extra] = process.argv.slice(2);
try {
  if (!path || extra.length || !['preflight', 'record', 'verify'].includes(mode)) {
    throw new Error('Usage: node tests/live/activation-recording.mjs preflight|record CONFIG.json | verify ATTEMPT_DIRECTORY');
  }
  if (mode === 'verify') {
    const result = inspect(path);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (!result.under15Minutes) process.exitCode = 1;
  } else {
    const prepared = loadConfig(path);
    if (mode === 'preflight') process.stdout.write('Config and local prerequisite files present. No live effects performed; prerequisite truth and root authorization need independent review.\n');
    else process.stdout.write(`Retained recording: ${await record(prepared)}\n`);
  }
} catch (error) {
  // Do not echo user config, receipt contents, command output, or native errors.
  let reason = 'validation/runtime failure; inspect retained sanitized attempt';
  try { reason = safeText(error.message); } catch {}
  process.stderr.write(`Recorder did not qualify: ${reason}\n`);
  process.exitCode = 1;
}
