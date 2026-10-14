import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export async function collectMigrations() {
  const modules = await readdir(resolve(root, 'src/modules'), { withFileTypes: true });
  const directories = [resolve(root, 'migrations'), ...modules.filter(x => x.isDirectory()).map(x => resolve(root, 'src/modules', x.name, 'migrations'))];
  const files = new Map();
  for (const directory of directories) {
    let names;
    try { names = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const name of names.filter(x => x.endsWith('.sql'))) {
      if (!/^\d+_[a-z0-9_-]+\.sql$/.test(name) || files.has(name)) throw new Error(`Invalid or duplicate migration: ${name}`);
      files.set(name, await readFile(join(directory, name), 'utf8'));
    }
  }
  const directory = resolve(root, '.generated/migrations');
  const ordered = [...files.keys()].sort().map(name => [name, files.get(name)]);
  // Local Wrangler and deploy-kit consume the same collected SQL. deploy-kit's
  // package contract currently reads migrations/core; this is generated output,
  // never the source of a migration.
  for (const output of [directory, resolve(root, 'migrations/core')]) {
    await mkdir(output, { recursive: true });
    // Never leave a removed SQL file runnable in a previously generated directory.
    for (const name of await readdir(output)) if (!files.has(name)) await rm(join(output, name));
    for (const [name, text] of ordered) await writeFile(join(output, name), text);
  }
  return { directory, files: ordered.map(([name]) => name) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await collectMigrations(), null, 2));
