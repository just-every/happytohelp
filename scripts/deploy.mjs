import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, collectMigrations } from './migrations.mjs';
import { run } from './deployment/run.mjs';
import { settings } from './deployment/config.mjs';
import { runtimeVariables } from './deployment/environment.mjs';
import { deployRemote } from './deployment/remote.mjs';

const args = process.argv.slice(2).filter(x => x !== '--');
if (args.length !== 1 || !['--local', '--remote'].includes(args[0])) throw new Error('Usage: pnpm run deploy -- --local|--remote');
await collectMigrations();
const local = args[0] === '--local';
const plan = local ? null : settings();
const env = { ...process.env };
delete env.CLOUDFLARE_ENV;
delete env.H2H_WRANGLER_CONFIG;
if (plan) {
  runtimeVariables({ ...env, APP_ORIGIN: plan.origin });
  env.H2H_WRANGLER_CONFIG = resolve(root, '.seed/deployment', plan.prefix, 'wrangler.json');
  const config = JSON.parse(await readFile(env.H2H_WRANGLER_CONFIG, 'utf8'));
  for (const [key,value] of Object.entries(runtimeVariables(env))) if (config.vars?.[key] !== value) throw new Error('Runtime variables changed since setup. Run setup for this target.');
  if (config.name !== plan.prefix || config.account_id !== plan.account || config.vars.APP_ORIGIN !== plan.origin) throw new Error('Setup configuration differs from deployment target. Run setup for this target.');
}
await run(['build'], { env, cwd: root });
const configPath = resolve(root, 'dist/server/wrangler.json');
const emitted = JSON.parse(await readFile(configPath, 'utf8'));
if (plan && (emitted.name !== plan.prefix || emitted.account_id !== plan.account || emitted.vars?.APP_ORIGIN !== plan.origin || !emitted.assets?.directory)) throw new Error('Built Worker does not match selected deployment.');
await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', local ? '--local' : '--remote', '--config', configPath, ...(local ? ['--persist-to', resolve(root, '.wrangler/state')] : [])], { env, cwd: root });
if (local) {
  await run(['exec', 'wrangler', 'deploy', '--dry-run', '--config', configPath], { env, cwd: root });
  console.log('Local Worker packaging verified; no cloud resources changed.');
} else {
  const { setupToken } = await deployRemote({ env, cwd: root, configPath, origin: plan.origin });
  console.log(`Deployed ${plan.prefix}; resource health responds at ${plan.origin}. ${setupToken === 'configured' ? 'First-owner setup at /setup requires the private H2H_SETUP_TOKEN.' : 'Owner setup was already complete.'} Provider behavior remains separately verifiable.`);
}
