import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const consumer = process.argv.includes('--consumer');
const base = process.env.RER_BASE_REPO;
if (!consumer && !base) throw new Error('Set RER_BASE_REPO to the Base checkout pinned by family.json.');
const components = [
  ['support', 'core', 'src/family/support'],
  ['support-email', 'modules/support-email', 'src/modules/support-email'],
  ['sendgrid-email', base ? resolve(base, 'modules/sendgrid-email') : '', 'src/modules/sendgrid-email'],
];
const selected = consumer ? JSON.parse(readFileSync('seed.json', 'utf8')).composition : null;
for (const [id, authorPath, consumerPath] of components) {
  if (selected && id !== selected.family && !selected.modules.includes(id)) continue;
  const source = resolve(consumer ? consumerPath : `${authorPath}/src`);
  const tests = resolve(consumer ? `tests/composition/${id}` : `${authorPath}/tests`);
  const files = readdirSync(tests).filter((file) => file.endsWith('.test.ts')).sort().map((file) => resolve(tests, file));
  const result = spawnSync(process.execPath, ['--test', ...files], {
    stdio: 'inherit', env: { ...process.env, RER_COMPONENT_SOURCE: pathToFileURL(`${source}/`).href },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
