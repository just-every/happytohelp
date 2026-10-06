import { spawn } from 'node:child_process';

export function commandFailureMessage(args, code) {
  const prefix = `Command ${args.slice(0, 3).join(' ')} failed (${code}).`;
  const r2BucketCommand = args[0] === 'exec'
    && args[1] === 'wrangler'
    && args[2] === 'r2'
    && args[3] === 'bucket';

  if (r2BucketCommand && args[4] === 'list') {
    return 'Cloudflare R2 bucket listing failed. Confirm that R2 is enabled for the selected account and the Wrangler identity has Workers R2 Storage: Edit access. No resources have been provisioned by this setup run; provider output is withheld.';
  }
  if (r2BucketCommand && args[4] === 'create') {
    return 'Cloudflare R2 bucket creation failed. Confirm that R2 is enabled for the selected account and the Wrangler identity has Workers R2 Storage: Edit access. A D1 database may already have been created; resolve the issue and rerun setup so it can reuse resources by name. Provider output is withheld.';
  }
  return `${prefix} No later step ran.`;
}

export async function run(args, { env = process.env, capture = false, cwd = process.cwd() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { cwd, env: { ...env, CI: 'true' }, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let stdout = '', stderr = '';
    if (capture) { child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; }); }
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(commandFailureMessage(args, code))));
  });
}
