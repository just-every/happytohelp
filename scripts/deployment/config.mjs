import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { root, collectMigrations } from '../migrations.mjs';
import { provisionResources } from './provision.mjs';
import { run } from './run.mjs';
import { runtimeVariables } from './environment.mjs';

export function settings(env = process.env) {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const prefix = env.H2H_RESOURCE_PREFIX;
  if (!/^[a-f0-9]{32}$/i.test(account || '')) throw new Error('CLOUDFLARE_ACCOUNT_ID required.');
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(prefix || '')) throw new Error('H2H_RESOURCE_PREFIX must be a lowercase resource name.');
  const url = new URL(env.H2H_PUBLIC_ORIGIN || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) throw new Error('H2H_PUBLIC_ORIGIN must be an HTTPS origin.');
  if (url.hostname.endsWith('.workers.dev') && url.hostname.split('.')[0] !== prefix) throw new Error('workers.dev hostname must identify the selected Worker.');
  return { account, prefix, origin: url.origin, hostname: url.hostname, resources: { worker: prefix, database: `${prefix}-db`, files: `${prefix}-files`, jobs: `${prefix}-jobs`, jobsDeadLetter: `${prefix}-jobs-dead` } };
}
export async function prepareRemote(env = process.env, execute = run) {
  const plan = settings(env);
  const selectedVariables = runtimeVariables({ ...env, APP_ORIGIN: plan.origin });
  const preview = selectedVariables.PREVIEW_ORIGIN ? new URL(selectedVariables.PREVIEW_ORIGIN) : null;
  if (preview?.hostname.endsWith('.workers.dev')) throw new Error('A separate custom-domain preview origin is required for this Worker.');
  const { directory } = await collectMigrations();
  const { databaseId } = await provisionResources({ resources: plan.resources, run: args => execute(['exec', 'wrangler', ...args], { env, cwd: root, capture: true }) });
  const config = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
  Object.assign(config, { name: plan.prefix, account_id: plan.account, main: resolve(root, config.main), workers_dev: plan.hostname.endsWith('.workers.dev'), routes: [...(plan.hostname.endsWith('.workers.dev') ? [] : [{ pattern: plan.hostname, custom_domain: true }]), ...(preview ? [{pattern:preview.hostname,custom_domain:true}] : [])],
    vars: { ...config.vars, ...selectedVariables, APP_ORIGIN: plan.origin },
    d1_databases: [{ binding: 'DB', database_name: plan.resources.database, database_id: databaseId, migrations_dir: directory }],
    r2_buckets: [{ binding: 'FILES', bucket_name: plan.resources.files }],
    queues: { producers: [{ binding: 'JOBS', queue: plan.resources.jobs }], consumers: [{ queue: plan.resources.jobs, dead_letter_queue: plan.resources.jobsDeadLetter, max_batch_size: 1, max_retries: 0 }] } });
  delete config.env;
  const path = resolve(root, '.seed/deployment', plan.prefix, 'wrangler.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  return { path, plan, databaseId };
}
