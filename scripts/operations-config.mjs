import { readFile } from 'node:fs/promises';
import { validateRuntimeEnvironment } from './deployment/environment.mjs';
export async function validateConfiguration(env) {
  validateRuntimeEnvironment(env);
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  if (!config.d1_databases?.some(x => x.binding === 'DB') || !config.r2_buckets?.some(x => x.binding === 'FILES') || !config.durable_objects?.bindings?.some(x => x.name === 'CONVERSATIONS') || !config.queues?.producers?.some(x => x.binding === 'JOBS')) throw new Error('Required native resource binding absent');
  if (env.H2H_PUBLIC_ORIGIN) {
    const origin = new URL(env.H2H_PUBLIC_ORIGIN);
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash || origin.port) throw new Error('Public origin must be an HTTPS origin');
  }
}
