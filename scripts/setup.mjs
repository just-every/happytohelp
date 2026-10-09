import { collectMigrations, root } from './migrations.mjs';
import { run } from './deployment/run.mjs';
import { prepareRemote, settings } from './deployment/config.mjs';
import { validateRuntimeEnvironment } from './deployment/environment.mjs';

const args = process.argv.slice(2).filter(x => x !== '--');
if (args.length !== 1 || !['--local', '--remote', '--plan'].includes(args[0])) throw new Error('Usage: pnpm run setup -- --local|--remote|--plan');
validateRuntimeEnvironment(process.env);
if (args[0] === '--plan') { console.log(JSON.stringify(settings(), null, 2)); process.exit(0); }
await collectMigrations();
if (args[0] === '--local') {
  await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--config', 'wrangler.jsonc'], { cwd: root });
  console.log('Local D1 is ready. Run pnpm dev, then open /setup to create the first owner with an email and password.');
} else {
  const prepared = await prepareRemote();
  await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', prepared.path], { cwd: root });
  console.log(`Resources and migrations prepared for ${prepared.plan.prefix}. Worker code has not been deployed.`);
}
