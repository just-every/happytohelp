// Requires the separately locked controller toolchain: npm ci --ignore-scripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const requireTool = createRequire(new URL('../toolchain/package.json', import.meta.url));
const exec = promisify(execFile);
const atLeast = (version, floor) => {
  const actual = version.split('.').map(Number), minimum = floor.split('.').map(Number);
  return actual.every(Number.isInteger) && actual.length === 3 &&
    actual[0] === minimum[0] &&
    (actual[1] > minimum[1] || actual[1] === minimum[1] && actual[2] >= minimum[2]);
};

test('controller lock and shipped Wrangler bundle exclude the reviewed vulnerable dependency versions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../toolchain/package.json', import.meta.url)));
  const lock = JSON.parse(await readFile(new URL('../toolchain/package-lock.json', import.meta.url)));
  assert.match(manifest.dependencies.wrangler, /^4\.\d+\.\d+$/);
  assert.equal(lock.packages['node_modules/wrangler'].version, manifest.dependencies.wrangler);
  assert.equal(requireTool('wrangler/package.json').version, manifest.dependencies.wrangler);
  for (const [name, floor] of [['sharp', '0.35.4'], ['undici', '7.29.1']]) {
    const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`);
    assert.ok(entries.length, `${name} must be examined, not omitted from the lock`);
    for (const [path, entry] of entries) {
      assert.ok(atLeast(entry.version, floor), `${path}@${entry.version} is below ${floor}`);
      assert.match(entry.integrity, /^sha512-/);
    }
    const installed = JSON.parse(await readFile(new URL(`../toolchain/node_modules/${name}/package.json`, import.meta.url)));
    assert.ok(atLeast(installed.version, floor));
  }
  // Wrangler bundles its own Undici as well as the Miniflare dependency that
  // npm audit sees. Inspect the published bundle, not just its package manifest.
  const bundle = await readFile(new URL('../toolchain/node_modules/wrangler/wrangler-dist/cli.js', import.meta.url), 'utf8');
  const bundledVersions = [...bundle.matchAll(/\/undici@([0-9.]+)\//g)].map(match => match[1]);
  assert.ok(bundledVersions.length, 'review the bundle format if its dependency markers change');
  for (const version of new Set(bundledVersions)) assert.ok(atLeast(version, '7.29.1'), `bundled undici@${version}`);
  // The native prebuilt dependency must also contain the libheif fix after a
  // scripts-disabled install, not just carry a patched JS package version.
  assert.ok(atLeast(requireTool('sharp').versions.heif, '1.23.2'));
});

test('installed Undici rejects an unrequested WebSocket protocol without terminating its process', async () => {
  // GHSA-rfgv-xxqx-mfg5: a real loopback handshake, isolated from the test runner
  // because the vulnerable version throws an uncaught exception.
  const sockets = new Set();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let request = '';
    socket.on('data', chunk => {
      request += chunk;
      if (!request.includes('\r\n\r\n')) return;
      const key = /Sec-WebSocket-Key: ([^\r]+)/i.exec(request)?.[1];
      const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.end(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: unsolicited\r\n\r\n`);
    });
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const script = `
      const { WebSocket } = require(${JSON.stringify(requireTool.resolve('undici'))});
      const timer = setTimeout(() => process.exit(2), 3000);
      const socket = new WebSocket('ws://127.0.0.1:${server.address().port}');
      socket.addEventListener('open', () => process.exit(3));
      socket.addEventListener('error', () => { clearTimeout(timer); console.log('handshake-rejected'); });
    `;
    const { stdout } = await exec(process.execPath, ['-e', script], {env:{}, timeout:5000});
    assert.equal(stdout.trim(), 'handshake-rejected');
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
