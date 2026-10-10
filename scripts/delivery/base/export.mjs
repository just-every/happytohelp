import {mkdir, readFile, readdir, writeFile, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {candidateRoot, outputLocation} from './paths.mjs';
import {packagingConfig} from './package.mjs';

/** Vendor the dependency-free Base runtime and explicit seed policy, never tests or evidence. */
export async function exportProducer({root = process.cwd(), config, output = 'scripts/delivery/base'} = {}) {
  packagingConfig(config);
  root = await candidateRoot(root);
  const destination = await outputLocation(root, `${output}/packaging.json`);
  const source = fileURLToPath(new URL('.', import.meta.url));
  const files = (await readdir(source)).filter(name => name.endsWith('.mjs')).sort();
  const generators = (await readdir(join(source,'generators'))).filter(name => name.endsWith('.mjs')).sort();
  await mkdir(destination.directory, {recursive:true});
  try {
    for (const name of [...files, ...generators.map(name => `generators/${name}`)]) {
      if (name.startsWith('generators/')) await mkdir(join(destination.directory,'generators'), {recursive:true});
      await writeFile(join(destination.directory,name), await readFile(join(source,name)), {flag:'wx'});
    }
    await writeFile(destination.manifest, `${JSON.stringify(config,null,2)}\n`, {flag:'wx'});
  } catch (error) {
    await rm(destination.directory, {recursive:true,force:true});
    throw error;
  }
  return destination.directory;
}
