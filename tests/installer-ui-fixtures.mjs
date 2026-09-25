// Browser fixtures run the real installer and UI. Do not invoke install or provider login.
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startInstaller } from '../scripts/installer/server.mjs';
import { safeKeys } from '../scripts/installer/ui/model.mjs';
const source = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'h2h-ui-actual-'));
const savedEnvironment = { ...process.env };
process.env.PATH = '';
for (const key of Object.keys(process.env)) if (/^(EMAIL_|CLOUDFLARE_)/.test(key)) delete process.env[key];
const common = { target: 'local', name: 'Test workspace', ownerName: 'Test owner', email: 'owner@example.test', allowedOrigin: 'https://example.test', primaryColor: '#7c3aed', emailProvider: 'later' };
const fixtures = [['none', {}, {}], ['partial', { target: 'local', name: 'Partial workspace', ownerName: 'Test owner', primaryColor: '#7c3aed' }, {}], ['all', common, { password: 'test-only-long-password' }]];
const servers = [];
try {
  for (const [name, answers, secretInput] of fixtures) {
    const root = join(directory, name);
    await mkdir(join(root, 'scripts/installer'), { recursive: true });
    await mkdir(join(root, 'public/setup'), { recursive: true });
    await mkdir(join(root, '.seed/installer'), { recursive: true });
    await cp(join(source, 'scripts/installer/ui'), join(root, 'scripts/installer/ui'), { recursive: true });
    await cp(join(source, 'public/setup/ocean.webp'), join(root, 'public/setup/ocean.webp'));
    await writeFile(join(root, '.seed/installer/state.json'), JSON.stringify({ phase: 'ready', draft: Object.fromEntries(safeKeys.map(key => [key, ''])) }));
    const server = await startInstaller(root, { answers, secretInput });
    servers.push(server); console.log(JSON.stringify({ fixture: name, origin: server.origin, root }));
  }
} finally {
  for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
  Object.assign(process.env, savedEnvironment);
}
async function close() { await Promise.all(servers.map(server => server.close())); await rm(directory, { recursive: true, force: true }); process.exit(); }
process.on('SIGINT', close); process.on('SIGTERM', close);
