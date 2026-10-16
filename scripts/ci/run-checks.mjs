import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

// Workflow-owned, whitespace-delimited argv; never evaluate shell or event input.
const commands = process.env.H2H_CI_COMMANDS?.trim().split('\n').map(line => line.trim()).filter(Boolean);
if (!commands?.length) throw new Error('H2H_CI_COMMANDS must list explicit checks');
const failures = [];
let active, interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; active?.kill(signal); });
for (const [index, command] of commands.entries()) {
  if (interrupted) break;
  if (!/^(?:node|pnpm) [\w./:=\s-]+$/.test(command)) throw new Error(`Unsupported check argv: ${command}`);
  const [executable, ...args] = command.split(/\s+/);
  // The index keeps names unique; the rest is only a readable hint, bounded to a valid file name.
  const name = `${index + 1}-${args.join('-').replace(/[^\w-]+/g, '-')}`.slice(0, 120);
  const env = {...process.env};
  if (env.H2H_EVIDENCE_DIR) {
    env.H2H_EVIDENCE_DIR = join(env.H2H_EVIDENCE_DIR, name);
    await mkdir(env.H2H_EVIDENCE_DIR, {recursive: true});
  }
  console.log(`::group::${command}`);
  const result = await new Promise(resolve => {
    active = spawn(executable, args, {stdio: 'inherit', env, shell: false});
    active.once('error', error => resolve({error: error.message}));
    active.once('exit', (code, signal) => resolve({code, signal}));
  });
  active = undefined;
  console.log('::endgroup::');
  if (result.code !== 0) failures.push({command, ...result});
}
if (failures.length || interrupted) {
  console.error(JSON.stringify({failures, interrupted}, null, 2));
  process.exitCode = 1;
}
