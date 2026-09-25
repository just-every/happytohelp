import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const digest = value => createHash('sha256').update(value).digest('hex');
const defaultRoot = new URL('../../', import.meta.url);
function origin(value, name) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) throw new Error(`${name} must be an HTTPS origin`);
  return url.origin;
}
export async function happytohelpPlan({ installationId, environment, variables, root = defaultRoot }) {
  if (typeof installationId !== 'string' || !installationId.trim()) throw new Error('installationId required');
  if (!['production', 'preview'].includes(environment)) throw new Error('Invalid environment');
  const config = JSON.parse(await readFile(new URL('wrangler.jsonc', root), 'utf8'));
  const { specInputs } = await import(new URL('scripts/delivery/spec-inputs.mjs', root));
  const resources = [...(config.d1_databases ?? []).map(x => ({kind:'d1',binding:x.binding})), ...(config.r2_buckets ?? []).map(x => ({kind:'r2',binding:x.binding})), ...(config.queues?.producers ?? []).map(x => ({kind:'queue',binding:x.binding}))];
  const suffixes = {DB:'db',FILES:'files',JOBS:'jobs',JOBS_DEAD_LETTER:'jobs-dead'};
  if (resources.some(x => !suffixes[x.binding]) || resources.length !== 4) throw new Error('HappyToHelp resource topology changed; refresh the managed binding contract');
  const queueBinding = name => { const producer = config.queues.producers.find(x => x.queue === name); if (!producer) throw new Error('Undeclared queue consumer'); return producer.binding; };
  const { variableNames, secretNames: allowedSecrets, validateRuntimeEnvironment } = await import(new URL('scripts/deployment/environment.mjs', root));
  const publicVariables = { APP_ORIGIN: origin(variables.H2H_PUBLIC_ORIGIN, 'H2H_PUBLIC_ORIGIN'), REGISTRATION_ENABLED: 'false' };
  for (const key of variableNames) if (variables[key] !== undefined) {
    if (typeof variables[key] !== 'string') throw new Error(`${key} must be a string`);
    publicVariables[key] = variables[key];
  }
  validateRuntimeEnvironment(publicVariables);
  if (!variables.RER_MANAGEMENT_ORIGIN) throw new Error('RER_MANAGEMENT_ORIGIN is required for managed installation');
  {
    publicVariables.RER_MANAGEMENT_ORIGIN = origin(variables.RER_MANAGEMENT_ORIGIN, 'RER_MANAGEMENT_ORIGIN');
    publicVariables.RER_INSTALLATION_ID = installationId;
    if (typeof variables.H2H_SETUP_OWNER_EMAIL !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(variables.H2H_SETUP_OWNER_EMAIL)) throw new Error('H2H_SETUP_OWNER_EMAIL is required for managed installation');
    publicVariables.H2H_SETUP_OWNER_EMAIL = variables.H2H_SETUP_OWNER_EMAIL.trim().toLowerCase();
  }
  const secretNames = [...(variables.secretNames ?? [])];
  if (variables.RER_MANAGEMENT_ORIGIN && !secretNames.includes('H2H_SETUP_TOKEN')) secretNames.push('H2H_SETUP_TOKEN');
  if (!Array.isArray(secretNames) || secretNames.some(name => !allowedSecrets.includes(name)) || new Set(secretNames).size !== secretNames.length) throw new Error('secretNames must select actual native provider bindings');
  for (const key of allowedSecrets) if (variables[key] !== undefined) throw new Error('Secret values must be supplied only to the delivery broker');
  if (environment === 'preview' && (!Array.isArray(variables.controlledProviders) || !variables.controlledProviders.length || variables.controlledProviders.some(x => typeof x !== 'string' || !x.trim()))) throw new Error('Preview requires explicit controlledProviders');
  const modules = await readdir(new URL('src/modules/', root), { withFileTypes: true });
  const directories = [new URL('migrations/', root), ...modules.filter(x => x.isDirectory()).map(x => new URL(`src/modules/${x.name}/migrations/`, root))];
  const collected = new Map();
  for (const directory of directories) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries.filter(x => x.name.endsWith('.sql'))) {
      if (!entry.isFile() || !/^\d+_[a-z0-9_-]+\.sql$/.test(entry.name) || collected.has(entry.name)) throw new Error('Invalid or duplicate migration');
      const sql = await readFile(new URL(entry.name, directory), 'utf8');
      collected.set(entry.name, { binding: 'DB', name: entry.name, sha256: digest(sql), sql });
    }
  }
  const prefix = `rer-${digest(installationId).slice(0, 16)}-${environment === 'production' ? 'prod' : 'preview'}-`;
  return {
    schema: 1, environment, workerName: prefix + 'happytohelp',
    resources: resources.map(resource => ({...resource, name:prefix + suffixes[resource.binding]})),
    migrations: [...collected.values()].sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    durableObjects: config.durable_objects.bindings.map(x => ({ binding: x.name, className: x.class_name })),
    durableObjectMigrations: config.migrations.map(x => ({ tag: x.tag, newSqliteClasses: x.new_sqlite_classes })),
    publicVariables, secretNames, healthPath: '/health',
    schedules: environment === 'production' ? config.triggers.crons : [],
    queueConsumers: environment === 'production' ? config.queues.consumers.map(x => ({binding:queueBinding(x.queue), ...(x.dead_letter_queue ? {deadLetterBinding:queueBinding(x.dead_letter_queue)} : {}), maxBatchSize:x.max_batch_size ?? 10, maxBatchTimeout:x.max_batch_timeout ?? 5, maxRetries:x.max_retries ?? 3})) : [],
    recovery: specInputs.recovery,
    ...(environment === 'preview' ? { previewEffects: { schedulesDisabled: true, controlledProviders: variables.controlledProviders } } : {}),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [installationId, environment, file] = process.argv.slice(2);
  if (!file) throw new Error('Usage: happytohelp-plan.mjs INSTALLATION_ID production|preview config.json');
  console.log(JSON.stringify(await happytohelpPlan({ installationId, environment, variables: JSON.parse(await readFile(file, 'utf8')) }), null, 2));
}
