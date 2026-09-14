import { access, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { collectMigrations, root } from './migrations.mjs';
import { run } from './deployment/run.mjs';
import { prepareRemote, settings } from './deployment/config.mjs';

const args = process.argv.slice(2).filter(x => x !== '--');
if (args.length !== 1 || !['--local', '--remote', '--plan'].includes(args[0])) throw new Error('Usage: pnpm run setup -- --local|--remote|--plan');
if (args[0] === '--plan') { console.log(JSON.stringify(settings(), null, 2)); process.exit(0); }
await collectMigrations();
if (args[0] === '--local') {
  const vars = resolve(root, '.dev.vars');
  try { await access(vars); } catch { await writeFile(vars, `BOOTSTRAP_TOKEN=${randomBytes(32).toString('hex')}\n`, { mode: 0o600, flag: 'wx' }); }
  await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--config', 'wrangler.jsonc'], { cwd: root });
  console.log('Local D1 is ready. Private bootstrap token is in .dev.vars. Run pnpm dev, then /setup.');
} else {
  const prepared = await prepareRemote();
  await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', prepared.path], { cwd: root });
  console.log(`Resources and migrations prepared for ${prepared.plan.prefix}. Worker code has not been deployed.`);
}
