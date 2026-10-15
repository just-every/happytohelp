// Explicit offline native-CLI probe; requires npm ci --ignore-scripts in toolchain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { candidate, policy, writeCandidate } from './fixtures.mjs';
import { materializeArtifact } from '../artifact.mjs';
import { configuration } from '../stage-adapter.mjs';

test('pinned Wrangler packages the fixed native topology offline without evaluating additional modules or decoding assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'h2h-toolchain-compatibility-'));
  try {
    const executionMarker = join(root, 'module-executed');
    const networkMarker = join(root, 'network-attempted');
    const guard = join(root, 'deny-network.cjs');
    await writeFile(guard, `
      const fs = require('node:fs');
      const deny = () => { fs.writeFileSync(${JSON.stringify(networkMarker)}, 'attempted'); throw new Error('offline-only'); };
      require('node:net').Socket.prototype.connect = deny;
      require('node:tls').connect = deny;
      require('node:dns').lookup = deny;
    `);
    const artifact = candidate();
    const module = `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(executionMarker)}, 'executed'); export const value = 1;`;
    artifact.modules[0].contentBase64 = Buffer.from(`import './additional.js'; export default {fetch(){return new Response('ok')}}; export class ConversationSocket {}`).toString('base64');
    artifact.modules.push({name:'additional.js', type:'esm', contentBase64:Buffer.from(module).toString('base64')});
    // Opaque bytes are legal static assets; deployment must not invoke an image decoder.
    artifact.assets.push({path:'/opaque.avif', contentBase64:Buffer.from('not an image').toString('base64'), contentType:'image/avif'});
    const target = policy(artifact), output = join(root, 'artifact');
    await writeCandidate(join(root, 'input.json'), artifact);
    await materializeArtifact(join(root, 'input.json'), output, target.artifactSha256);
    await writeFile(join(output, 'wrangler.json'), JSON.stringify(configuration(target)));
    await writeFile(join(output, 'secrets.json'), JSON.stringify({H2H_SETUP_TOKEN:'synthetic-test-setup-token-that-is-at-least-32-characters'}));
    const tool = fileURLToPath(new URL('../toolchain/node_modules/wrangler/bin/wrangler.js', import.meta.url));
    const run = args => {
      const result = spawnSync(process.execPath, ['--require', guard, tool, ...args], {
        cwd:output, env:{PATH:process.env.PATH, HOME:root, CI:'true', WRANGLER_SEND_METRICS:'false'},
        encoding:'utf8', timeout:60000,
      });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      return result.stdout;
    };
    assert.match(run(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', 'wrangler.json', '--help']), /migrations apply/);
    assert.match(run(['deploy', '--dry-run', '--no-bundle', '--config', 'wrangler.json', '--secrets-file', 'secrets.json', '--outdir', 'packaged']), /--dry-run: exiting now/);
    assert.equal(await readFile(join(output, 'packaged/additional.js'), 'utf8'), module);
    assert.equal(await readFile(join(output, 'assets/opaque.avif'), 'utf8'), 'not an image');
    await assert.rejects(access(executionMarker));
    await assert.rejects(access(networkMarker));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});
