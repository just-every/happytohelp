import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const {localAgentArchive, FIXED_MTIME} = createRequire(import.meta.url)('../scripts/local-agent-archive.cjs');

async function source(base, {mtime, executableMode}) {
  const directory = join(base, 'local-agent');
  await mkdir(join(directory, 'bin'), {recursive: true});
  await mkdir(join(directory, 'lib', 'providers'), {recursive: true});
  await writeFile(join(directory, 'package.json'), '{"name":"connector"}\n');
  await writeFile(join(directory, 'bin', 'h2h-local.mjs'), '#!/usr/bin/env node\n');
  await writeFile(join(directory, 'lib', 'b.mjs'), 'export const b = 2;\n');
  await writeFile(join(directory, 'lib', 'a.mjs'), 'export const a = 1;\n');
  await writeFile(join(directory, 'lib', 'providers', `${'n'.repeat(90)}.mjs`), 'export {};\n');
  await chmod(join(directory, 'bin', 'h2h-local.mjs'), executableMode);
  await chmod(join(directory, 'lib', 'a.mjs'), 0o600);
  for (const path of ['package.json', 'bin/h2h-local.mjs', 'lib/a.mjs', 'lib/b.mjs']) await utimes(join(directory, path), mtime, mtime);
  return directory;
}

test('local connector archive bytes depend only on packaged content', async () => {
  const base = await mkdtemp(join(tmpdir(), 'h2h-agent-archive-'));
  try {
    const first = await source(join(base, 'one'), {mtime: new Date('2020-01-02T03:04:05Z'), executableMode: 0o755});
    const second = await source(join(base, 'two', 'deeper', 'path'), {mtime: new Date(), executableMode: 0o700});
    const options = {topLevel: 'happytohelp-local-agent', inputs: ['package.json', 'lib', 'bin']};
    const archive = localAgentArchive({source: first, ...options});
    assert.deepEqual(localAgentArchive({source: second, ...options}), archive);
    assert.deepEqual([...archive.subarray(4, 10)], [0, 0, 0, 0, 2, 3], 'gzip header has no timestamp and a fixed OS byte');
    assert.ok(!gunzipSync(archive).includes(Buffer.from(base)), 'archive does not name the source directory');

    const extracted = join(base, 'extracted');
    await mkdir(extracted);
    execFileSync('tar', ['-xzf', '-', '-C', extracted], {input: archive});
    const listing = execFileSync('tar', ['-tzf', '-'], {input: archive, encoding: 'utf8'}).trim().split('\n');
    assert.deepEqual(listing, [
      'happytohelp-local-agent/',
      'happytohelp-local-agent/bin/',
      'happytohelp-local-agent/bin/h2h-local.mjs',
      'happytohelp-local-agent/lib/',
      'happytohelp-local-agent/lib/a.mjs',
      'happytohelp-local-agent/lib/b.mjs',
      'happytohelp-local-agent/lib/providers/',
      `happytohelp-local-agent/lib/providers/${'n'.repeat(90)}.mjs`,
      'happytohelp-local-agent/package.json',
    ]);
    const output = join(extracted, 'happytohelp-local-agent');
    assert.equal(await readFile(join(output, 'lib', 'a.mjs'), 'utf8'), 'export const a = 1;\n');
    assert.equal(await readFile(join(output, 'package.json'), 'utf8'), '{"name":"connector"}\n');
    const executable = await stat(join(output, 'bin', 'h2h-local.mjs'));
    assert.equal(executable.mode & 0o111, 0o111 & ~process.umask());
    assert.equal((await stat(join(output, 'lib', 'a.mjs'))).mode & 0o777, 0o644 & ~process.umask());
    assert.equal(Math.floor(executable.mtimeMs / 1000), FIXED_MTIME);

    await symlink('../package.json', join(first, 'lib', 'link.mjs'));
    assert.throws(() => localAgentArchive({source: first, ...options}), /cannot contain symlinks/);
  } finally {
    await rm(base, {recursive: true, force: true});
  }
});
