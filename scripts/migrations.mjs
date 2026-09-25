import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
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
  await mkdir(directory, { recursive: true });
  // Never leave a removed SQL file runnable in a previously generated directory.
  const { rm } = await import('node:fs/promises');
  for (const name of await readdir(directory)) if (!files.has(name)) await rm(join(directory, name));
  for (const [name, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) await writeFile(join(directory, name), text);
  return { directory, files: [...files.keys()].sort() };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await collectMigrations(), null, 2));
