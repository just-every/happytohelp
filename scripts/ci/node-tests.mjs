import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';

// Keep the existing test inventories and Node concurrency flags authoritative.
// Split by file, retaining every assertion and adding no alternate test behavior.
const [suite, shard] = process.argv.slice(2);
let args;
if (suite === 'modules') {
  ({moduleTestArgs: args} = await import('../verify-modules.mjs'));
} else {
  const allowed = ['test:move-in', 'test:reports', 'test:connections', 'test:first-run'];
  if (!allowed.includes(suite)) throw new Error(`Unknown Node test inventory: ${suite}`);
  const {scripts} = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  const command = scripts[suite].split(' && ')[0];
  if (!/^node --test [\w./=\s-]+$/.test(command)) throw new Error(`Expected an explicit Node test inventory in ${suite}`);
  args = command.split(/\s+/).slice(1);
}
if (shard) {
  if (!/^[1-9]\d*\/[1-9]\d*$/.test(shard)) throw new Error('Expected shard index/count');
  const [index, count] = shard.split('/').map(Number);
  if (index > count) throw new Error('Shard index exceeds count');
  args = [`--test-shard=${shard}`, ...args];
}
const child = spawn(process.execPath, args, {stdio: 'inherit', env: {...process.env, WRANGLER_SEND_METRICS: 'false'}});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.once('error', error => { console.error(error); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
