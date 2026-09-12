import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { deploymentSettings, prepareRemote, validateEmitted, initializeOwner } from './setup-deployment.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const received = process.argv.slice(2).filter(arg => arg !== '--');
const setupOnly = received.includes('--setup-only');
const args = received.filter(arg => arg !== '--setup-only');
if (!args.length && process.env.H2H_DEPLOY_MODE) args.push(`--${process.env.H2H_DEPLOY_MODE}`);
if (args.length !== 1 || !['--local', '--remote'].includes(args[0])) throw new Error('Choose exactly one target: pnpm run deploy -- --local or --remote, or set H2H_DEPLOY_MODE=local|remote.');
const local = args[0] === '--local';
const env = { ...process.env, CI: 'true' };
// Generated config represents one explicit environment; inherited selection
// must never redirect the build to another environment.
delete env.CLOUDFLARE_ENV;
delete env.H2H_WRANGLER_CONFIG;
function run(argv, capture = false) {
  return new Promise((done, fail) => {
    const child = spawn('pnpm', argv, { cwd: root, env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let output = '';
    if (capture) { child.stdout.on('data', chunk => { output += chunk; }); child.stderr.resume(); }
    child.once('error', () => fail(new Error('Could not start pnpm.')));
    child.once('exit', code => code === 0 ? done(output) : fail(new Error(`Deployment step ${argv.slice(0, 3).join(' ')} failed (${code}); no later step ran.`)));
  });
}

const settings = local ? null : deploymentSettings(env);
await run(['typecheck']);
await run(['test']);
if (local) {
  await run(['setup:local']);
  await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'happytohelp', '--local', '--config', 'wrangler.jsonc']);
  if (setupOnly) { console.log('Local private configuration and D1 migrations prepared.'); process.exit(0); }
  await run(['build']);
  await run(['exec', 'wrangler', 'deploy', '--dry-run', '--config', 'dist/server/wrangler.json']);
  console.log('Local migrations and built Worker packaging verified. No cloud resources were changed.');
} else {
  const { withSecretJsonFile } = await import('./deployment/base-secret-json.mjs');
  const { waitForDeploymentHealth } = await import('./deployment/health.mjs');
  const resource = await prepareRemote(root, settings, run);
  env.H2H_WRANGLER_CONFIG = resource.path;
  if (setupOnly) {
    await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', settings.database, '--remote', '--config', resource.path]);
    console.log(`Prepared ${settings.name}: owner-controlled D1 resource, ignored config and migrations. Run deploy to publish and initialize the owner.`);
    process.exit(0);
  }
  await run(['build']);
  const emitted = resolve(root, 'dist/server/wrangler.json');
  validateEmitted(JSON.parse(await readFile(emitted, 'utf8')), settings, resource.id);
  await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', settings.database, '--remote', '--config', emitted]);
  await withSecretJsonFile(settings.secrets, path => run(['exec', 'wrangler', 'deploy', '--config', emitted, '--secrets-file', path]));
  await waitForDeploymentHealth(settings.origin + '/health');
  await initializeOwner(settings);
  console.log(`Deployed ${settings.name}; health and configured owner verified at ${settings.origin}.`);
}
