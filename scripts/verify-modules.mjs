import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Browser and emitted-Worker checks need a built application and run separately.
const standalone = [
  'deleted-background.mjs', 'conversation-admission.mjs',
  'conversation-socket.mjs', 'customer-context-routes.mjs', 'email-provider.mjs', 'email-worker.mjs',
  'github-integration.mjs', 'identity.mjs', 'identity-setup.mjs', 'knowledge-context.mjs',
  'knowledge-workerd.mjs', 'lead-operations.mjs', 'legacy-import.mjs', 'local-computer-runtime.mjs',
  'operating-environment.mjs', 'management.mjs', 'plugin-sdk.mjs', 'public-help-center.mjs',
  'site-preview.mjs', 'not-found-response.mjs', 'delivery-deployment-spec.mjs', 'delivery-migration-order.mjs',
  'ui-transport.mjs', 'login-return.mjs', 'widget-transport.mjs',
].map(name => `tests/${name}`);
const groups = ['tests/ai-support', 'tests/customer-context', 'tests/eval-harness', 'tests/training', 'local-agent/test'];
for (const group of groups) {
  const files = await readdir(new URL(`../${group}/`, import.meta.url));
  standalone.push(...files.filter(name => /\.test\.(?:mjs|cjs|js)$/.test(name)).map(name => `${group}/${name}`));
}
const child = spawn(process.execPath, ['--test', '--test-concurrency=2', ...standalone.sort()], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
