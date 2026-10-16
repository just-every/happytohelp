import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readdir, realpath, rm, symlink, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {parseArgs, promisify} from 'node:util';
import {localOperation} from '@runeditrun/rer/local/operation';
import {inspectionContext, localProcessConflict} from '@runeditrun/rer/process-diagnostics';
import {exportD1Sql} from './installer/search-index-sql.mjs';

const exec = promisify(execFile);
const usage = 'node scripts/export-d1.mjs (--local | --remote) --output FILE [--database DB] [--config wrangler.jsonc] [--persist-to .wrangler/state]';

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error('Local persistence contains a link or special file; resolve its placement before exporting.');
  }
  return files;
}

async function stopped(root, persist) {
  const conflict = await localProcessConflict(root, undefined, inspectionContext({verb: 'reset'}));
  if (conflict) throw new Error(`A local process holds this installation (PID ${conflict.pid}). Stop dev, preview and background writers before exporting.`);
  if (persist === join(root, '.wrangler/state')) return;
  // Base observes canonical checkout state. An explicitly selected alternate
  // directory needs its own open-file check as well; failed inspection refuses.
  const files = await filesIn(persist);
  if (!files.length) throw new Error('The selected persistence directory is empty; refusing to export a newly created database.');
  try {
    const {stdout} = await exec(process.platform === 'darwin' ? '/usr/sbin/lsof' : 'lsof', ['-t', '--', ...files], {timeout: 15000, maxBuffer: 1024 * 1024});
    if (stdout.trim()) throw new Error('A process holds the selected persistence directory. Stop its writers before exporting.');
  } catch (error) {
    if (error.code === 1 && error.stdout === '' && error.stderr === '') return;
    // Never print subprocess output: it may contain private paths or data.
    throw new Error('Could not establish that the selected persistence directory is stopped.', {cause: error});
  }
}

async function main() {
  const {values} = parseArgs({options: {
    database: {type: 'string', default: 'DB'}, config: {type: 'string', default: 'wrangler.jsonc'},
    'persist-to': {type: 'string'}, output: {type: 'string'},
    local: {type: 'boolean'}, remote: {type: 'boolean'}, help: {type: 'boolean'},
  }});
  if (values.help) {console.log(usage); return;}
  if (Boolean(values.local) === Boolean(values.remote) || !values.output || !values.database.trim()) throw new Error(usage);
  if (values.remote && values['persist-to']) throw new Error('--persist-to requires --local.');
  const configPath = resolve(values.config), root = await realpath(dirname(configPath)), output = resolve(values.output);
  const require = createRequire(import.meta.url);
  const wrangler = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
  // Do not load legacy .env/private key files. Wrangler uses inherited account
  // credentials only for an explicitly selected --remote operation.
  process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false';
  process.env.WRANGLER_SEND_METRICS = 'false';
  // D1 --json is written at Wrangler's normal log level. Capture that output
  // privately; suppressing it would also discard the inspection result.
  process.env.WRANGLER_LOG = 'log';
  const env = {...process.env, CI: '1', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false'};
  let operation, temporary, child, interrupted;
  const interrupt = signal => {
    interrupted ??= signal;
    child?.kill('SIGTERM');
  };
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  const run = async args => {
    try {
      const request = exec(process.execPath, [wrangler, ...args], {cwd: root, env, maxBuffer: 8 * 1024 * 1024});
      child = request.child;
      return (await request).stdout;
    } catch (error) {
      // Remote Wrangler output includes a signed download URL. Keep all raw
      // command output out of terminal diagnostics, including failure paths.
      throw new Error(`Wrangler D1 ${args[1]} failed (${error.code ?? error.signal ?? 'unknown'}). The backup is incomplete.`, {cause: error});
    } finally {child = undefined;}
  };
  try {
    let selectedConfig = configPath, persist;
    if (values.local) {
      operation = await localOperation(root);
      persist = await realpath(values['persist-to'] ? resolve(values['persist-to']) : join(root, '.wrangler/state'));
      await stopped(root, persist);
      const {unstable_readConfig: readConfig} = await import('wrangler');
      const config = readConfig({config: configPath});
      const database = config.d1_databases.find(row => row.binding === values.database || row.database_name === values.database || row.database_id === values.database);
      if (!database) throw new Error('The selected database is absent from the Wrangler configuration.');
      // The pinned Wrangler export command has no --persist-to option. Give
      // its ordinary export a private config whose default state is the exact
      // selected directory. No binding, database or preview identity changes.
      temporary = await mkdtemp(join(tmpdir(), 'h2h-sql-export-'));
      await mkdir(join(temporary, '.wrangler'));
      await symlink(persist, join(temporary, '.wrangler/state'), 'dir');
      selectedConfig = join(temporary, 'wrangler.json');
      await writeFile(selectedConfig, JSON.stringify({name: config.name, compatibility_date: config.compatibility_date, d1_databases: [database]}), {mode: 0o600});
    }
    const target = [values.local ? '--local' : '--remote', '--config', selectedConfig];
    const inspect = async ({sql}) => {
      const raw = await run(['d1', 'execute', values.database, ...target, ...(persist ? ['--persist-to', persist] : []), '--command', sql, '--json']);
      let result;
      try {result = JSON.parse(raw);} catch {throw new Error('Wrangler did not return valid D1 JSON.');}
      if (!Array.isArray(result) || result.length !== 1 || result[0]?.success === false || !Array.isArray(result[0]?.results)) throw new Error('Wrangler did not return a successful D1 result.');
      return result[0];
    };
    await exportD1Sql({inspect, output, runExport: async () => {
      if (interrupted) throw new Error(`Export interrupted by ${interrupted}; restoring the search index.`);
      await run(['d1', 'export', values.database, ...target, '--output', output, '--skip-confirmation']);
      if (interrupted) throw new Error(`Export interrupted by ${interrupted}; restoring the search index.`);
    }});
    console.log(`Private SQL backup written to ${output}`);
  } finally {
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
    try {if (temporary) await rm(temporary, {recursive: true, force: true});}
    finally {await operation?.release();}
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
