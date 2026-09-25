import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream, existsSync} from 'node:fs';
import {cp, mkdir, mkdtemp, readFile, realpath, rm, utimes} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {homedir, tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Builds the current source twice at unrelated absolute paths, from fresh
// installs, and requires byte-identical delivery artifacts that name neither
// checkout, the source repository, the temporary directory nor the home directory.
// The second checkout's files carry an old modification time and its build starts
// a few seconds later, so copied timestamps and build clocks cannot line up.
const root = fileURLToPath(new URL('..', import.meta.url));
const pnpm = process.env.npm_execpath;
const artifactFile = 'delivery-artifact/happytohelp-worker-artifact.json';
// Absolute filesystem locations a builder could leak (macOS, Linux and CI).
const absolutePath = /(?<![\w.@~-])\/(?:Users|home|private|tmp|var\/folders|root)\/[^\s"'`\\]*/g;
// Product copy: the example workspace folders shown in local computer settings.
const productExamples = new Set(['/Users/you/projects/web', '/Users/you/projects/api']);

function run(cwd, log, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {cwd, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, WRANGLER_SEND_METRICS: 'false'}});
    child.stdout.pipe(log, {end: false});
    child.stderr.pipe(log, {end: false});
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited ${code} in ${cwd}; see ${log.path}`)));
  });
}

async function buildAt(checkout, files, {sourceTime, startDelay}) {
  await mkdir(checkout, {recursive: true});
  for (const file of files) {
    await cp(join(root, file), join(checkout, file), {recursive: false, verbatimSymlinks: true});
    if (sourceTime) await utimes(join(checkout, file), sourceTime, sourceTime);
  }
  await delay(startDelay);
  const log = createWriteStream(join(dirname(checkout), `${checkout.split('/').pop()}-build.log`));
  try {
    await run(checkout, log, [pnpm, 'install', '--frozen-lockfile', '--offline']);
    await run(checkout, log, [pnpm, 'run', 'build']);
    await run(checkout, log, ['scripts/build-delivery-artifact.mjs']);
  } finally { log.end(); }
  return readFile(join(checkout, artifactFile));
}

function entries(bytes) {
  const artifact = JSON.parse(bytes.toString('utf8'));
  return new Map([...artifact.modules.map(x => [`module:${x.name}`, x.contentBase64]), ...artifact.assets.map(x => [`asset:${x.path}`, x.contentBase64]), ['deploymentSpec', JSON.stringify(artifact.deploymentSpec)]]);
}

test('delivery artifact is byte-reproducible across checkout paths and names no builder path', {timeout: 15 * 60_000}, async () => {
  assert.ok(pnpm, 'Run through `pnpm run test:reproducible-build` so the same pnpm installs each checkout.');
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd: root, encoding: 'utf8'})
    .split('\0').filter(file => file && existsSync(join(root, file)));
  const base = await realpath(await mkdtemp(join(tmpdir(), 'h2h-repro-')));
  const checkouts = [join(base, 'a'), join(base, 'b', 'deeper', 'nested', 'checkout')];
  let passed = false;
  try {
    const [first, second] = await Promise.all([
      buildAt(checkouts[0], files, {startDelay: 0}),
      buildAt(checkouts[1], files, {sourceTime: new Date('2001-02-03T04:05:06Z'), startDelay: 3000}),
    ]);
    const digests = [first, second].map(bytes => createHash('sha256').update(bytes).digest('hex'));
    console.log(`artifact sha256 ${digests[0]} ${digests[1]}`);
    if (digests[0] !== digests[1]) {
      const [a, b] = [entries(first), entries(second)];
      const differing = [...new Set([...a.keys(), ...b.keys()])].filter(key => a.get(key) !== b.get(key));
      assert.fail(`Artifacts differ in: ${differing.join(', ')}`);
    }
    const forbidden = [...new Set([...checkouts, base, root.replace(/\/$/, ''), await realpath(tmpdir()), tmpdir(), homedir()])];
    const leaks = [];
    for (const [key, content] of entries(first)) {
      const text = key === 'deploymentSpec' ? content : Buffer.from(content, 'base64').toString('latin1');
      for (const path of forbidden) if (text.includes(path)) leaks.push(`${key} names ${path}`);
      for (const [match] of text.matchAll(absolutePath)) if (!productExamples.has(match)) leaks.push(`${key} names ${match}`);
    }
    assert.deepEqual(leaks, []);
    passed = true;
  } finally {
    if (passed) await rm(base, {recursive: true, force: true});
    else console.error(`Reproducibility checkouts and build logs retained in ${base}`);
  }
});
