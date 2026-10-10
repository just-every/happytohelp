import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {resolve, join, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256} from './helpers/recovery/snapshot.mjs';

// Run from the exact source checkout to be built. The output directory must be
// new; an old artifact or stale dist must never satisfy provenance.
const output = resolve(process.argv[2] || '.local-evidence/recovery/build');
await mkdir(output, {recursive: true});
function command(program, args) {
  const result = spawnSync(program, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  assert.equal(result.status, 0, `${program} ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}
const sourceSha = command('git', ['rev-parse', 'HEAD']);
assert.equal(command('git', ['diff', 'HEAD', '--name-only']), '', 'Tracked source changes invalidate provenance');
assert.equal(command('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src', 'public', 'scripts', 'migrations', 'package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'wrangler.jsonc']), '', 'Untracked or changed build inputs invalidate provenance');
const startedAt = new Date().toISOString();
await rm(resolve('dist'), {recursive: true, force: true});
const build = spawnSync('pnpm', ['run', 'build'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
await writeFile(join(output, 'build.log'), `${build.stdout || ''}${build.stderr || ''}`);
assert.equal(build.status, 0, 'Build failed; inspect build.log');
const {produceArtifact} = await import(pathToFileURL(resolve('scripts/delivery/build.mjs')));
const artifactPath = await produceArtifact({output: relative(process.cwd(),join(output, 'delivery-artifact/artifact.json'))});
const artifactBytes = await readFile(artifactPath);
const artifact = JSON.parse(artifactBytes);
assert.equal(command('git', ['diff', 'HEAD', '--name-only']), '', 'Build modified tracked source');
const receipt = {
  sourceSha, sourceRoot: process.cwd(), startedAt, finishedAt: new Date().toISOString(),
  node: process.version, pnpm: command('pnpm', ['--version']), command: 'pnpm run build', buildExit: build.status,
  artifactSha256: sha256(artifactBytes), buildLogSha256: sha256(await readFile(join(output, 'build.log'))),
  lockfileSha256: sha256(await readFile('pnpm-lock.yaml')),
  migrations: artifact.deploymentSpec.migrations.map(({name, sha256}) => ({name, sha256})),
};
await writeFile(join(output, 'build.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(receipt, null, 2));
