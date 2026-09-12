import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { isIP } from 'node:net';

export function deploymentSettings(env) {
  const required = name => { if (!env[name]?.trim()) throw new Error(`${name} is required for remote deployment.`); return env[name]; };
  const account = required('CLOUDFLARE_ACCOUNT_ID');
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error('CLOUDFLARE_ACCOUNT_ID must identify the owner account.');
  const providerToken = required('CLOUDFLARE_API_TOKEN');
  const environment = required('H2H_DEPLOY_ENV');
  if (!/^[a-z][a-z0-9-]{0,24}$/.test(environment)) throw new Error('H2H_DEPLOY_ENV must be a lowercase slug up to 25 characters.');
  const origin = new URL(required('APP_ORIGIN'));
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || isIP(origin.hostname) || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_ORIGIN must be an HTTPS origin without credentials, port, path or query.');
  const name = `support-happytohelp-${environment}`;
  let workersDevSubdomain = null;
  if (origin.hostname.endsWith('.workers.dev')) {
    const match = origin.hostname.match(/^([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev$/);
    if (!match || match[1] !== name) throw new Error('workers.dev APP_ORIGIN must name the exact generated Worker and account subdomain.');
    workersDevSubdomain = match[2];
  }
  const secrets = { H2H_BOOTSTRAP_TOKEN: required('H2H_BOOTSTRAP_TOKEN') };
  if (secrets.H2H_BOOTSTRAP_TOKEN.length > 256) throw new Error('H2H_BOOTSTRAP_TOKEN exceeds the application limit.');
  if (Boolean(env.SENDGRID_API_KEY) !== Boolean(env.MAIL_FROM)) throw new Error('Configure SENDGRID_API_KEY and MAIL_FROM together.');
  if (env.SENDGRID_API_KEY) secrets.SENDGRID_API_KEY = env.SENDGRID_API_KEY;
  if (env.MAIL_FROM && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.MAIL_FROM)) throw new Error('MAIL_FROM must be a verified sender email address.');
  const owner = { email: required('H2H_OWNER_EMAIL'), password: required('H2H_OWNER_PASSWORD'), name: required('H2H_OWNER_NAME') };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email) || owner.password.length < 12 || owner.password.length > 256 || owner.name.length > 100) throw new Error('Owner email, password (12–256 characters), and name (up to 100 characters) must meet application requirements.');
  return { account, providerToken, workersDevSubdomain, environment, origin: origin.origin, hostname: origin.hostname, name, database: `support-happytohelp-${environment}-db`, secrets, owner, mailFrom: env.MAIL_FROM };
}

export function databaseId(rows, name) {
  if (!Array.isArray(rows)) throw new Error('Wrangler D1 list JSON is not an array; refusing to create resources.');
  const matches = rows.filter(row => row.name === name);
  if (matches.length > 1) throw new Error('D1 name is ambiguous.');
  if (!matches.length) return null;
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(matches[0].uuid)) throw new Error('Wrangler returned an invalid D1 UUID.');
  return matches[0].uuid;
}

export async function verifyWorkersDevAccount(settings, fetcher = fetch) {
  if (!settings.workersDevSubdomain) return;
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${settings.account}/workers/subdomain`, {
    headers: { Authorization: `Bearer ${settings.providerToken}` }, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Cannot verify account workers.dev identity (HTTP ${response.status}); no resource changes made.`);
  const body = await response.json();
  if (body.success !== true || body.result?.subdomain !== settings.workersDevSubdomain) throw new Error('APP_ORIGIN workers.dev subdomain does not match the selected Cloudflare account; no resource changes made.');
}

export async function prepareRemote(root, settings, run, fetcher = fetch) {
  await verifyWorkersDevAccount(settings, fetcher);
  const list = async () => databaseId(JSON.parse(await run(['exec', 'wrangler', 'd1', 'list', '--json'], true)), settings.database);
  let id = await list();
  if (!id) {
    await run(['exec', 'wrangler', 'd1', 'create', settings.database]);
    id = await list();
    if (!id) throw new Error('Created D1 database was not found in subsequent structured list.');
  }
  const config = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
  Object.assign(config, { name: settings.name, account_id: settings.account, main: resolve(root, config.main), workers_dev: Boolean(settings.workersDevSubdomain),
    routes: settings.workersDevSubdomain ? [] : [{ pattern: settings.hostname, custom_domain: true }],
    vars: { APP_ORIGIN: settings.origin, ...(settings.mailFrom ? { MAIL_FROM: settings.mailFrom } : {}) },
    d1_databases: [{ binding: 'DB', database_name: settings.database, database_id: id, migrations_dir: resolve(root, 'migrations') }] });
  delete config.env;
  const path = resolve(root, '.wrangler/h2h-deployment', settings.environment, 'wrangler.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  return { path, id };
}

export function validateEmitted(config, settings, id) {
  const validRoute = settings.workersDevSubdomain
    ? config.workers_dev === true && (!config.routes || config.routes.length === 0)
    : config.workers_dev === false && config.routes?.length === 1 && config.routes[0].custom_domain === true && config.routes[0].pattern === settings.hostname;
  if (config.name !== settings.name || config.account_id !== settings.account || config.d1_databases?.length !== 1 ||
      config.d1_databases[0].binding !== 'DB' || config.d1_databases[0].database_id !== id ||
      config.vars?.APP_ORIGIN !== settings.origin || !validRoute ||
      !config.main || config.main.includes('src/server') || !config.assets?.directory) throw new Error('Built Worker configuration does not match the selected owner deployment.');
}

export async function initializeOwner(settings) {
  const call = async (path, body) => {
    const response = await fetch(settings.origin + path, { method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', Origin: settings.origin }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Owner initialization rejected (HTTP ${response.status}); existing identity was not changed.`);
    return response.json();
  };
  const session = await call('/api/session');
  if (typeof session.bootstrapRequired !== 'boolean') throw new Error('Invalid owner initialization response.');
  const result = session.bootstrapRequired
    ? await call('/api/auth/bootstrap', { ...settings.owner, bootstrapToken: settings.secrets.H2H_BOOTSTRAP_TOKEN })
    : await call('/api/auth/signin', { email: settings.owner.email, password: settings.owner.password });
  if (result.operator?.email !== settings.owner.email.trim().toLowerCase()) throw new Error('Owner identity mismatch; refusing to continue.');
}
