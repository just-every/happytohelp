import { spawn } from 'node:child_process';
export async function run(args, { env = process.env, capture = false, cwd = process.cwd() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { cwd, env: { ...env, CI: 'true' }, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let stdout = '', stderr = '';
    if (capture) { child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; }); }
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Command ${args.slice(0, 3).join(' ')} failed (${code}). No later step ran.`)));
  });
}
