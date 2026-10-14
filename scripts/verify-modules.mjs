import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
// Browser and emitted-Worker checks need a built application and run separately.
const standalone = [
  'live/mail-receipt.test.mjs',
  'base-copy-verification.mjs', 'base-origin-verification.mjs', 'base-latest-integration.mjs', 'provider-errors.mjs', 'publication-metadata.mjs', 'help-center-link-contrast.mjs', 'appearance-settings.mjs', 'article-capability.mjs',
  'widget-meta-tags.mjs', 'widget-citations.mjs', 'sender-domain.mjs', 'delegation-sqlite.mjs', 'module-boundaries.mjs', 'generation-command-identity.mjs', 'widget-events.mjs', 'email-recovery.mjs', 'email-classification.mjs', 'deleted-background.mjs', 'conversation-admission.mjs',
  'conversation-socket.mjs', 'customer-context-routes.mjs', 'email-provider.mjs', 'sendgrid-email.mjs', 'sendgrid-inbound.mjs', 'cloudflare-email.mjs', 'email-worker.mjs',
  'github-integration.mjs', 'github-discovery.mjs', 'github-workerd-runtime.mjs', 'identity.mjs', 'identity-setup.mjs', 'identity-links.mjs', 'magic-link.mjs', 'management-invitations.mjs', 'knowledge-context.mjs',
  'knowledge-workerd.mjs', 'lead-operations.mjs', 'legacy-import.mjs', 'local-computer-runtime.mjs', 'local-computer-revocation.mjs',
  'local-draft-adoption.mjs', 'operating-environment.mjs', 'management.mjs', 'library-validation.mjs', 'contact-erasure.mjs', 'demo-inbox.mjs', 'demo-transcript-events.mjs', 'plugin-sdk.mjs', 'public-help-center.mjs',
  'site-preview.mjs', 'workspace-artwork.mjs', 'not-found-response.mjs', 'error-response.mjs', 'provider-effects.mjs', 'delivery-deployment-spec.mjs', 'delivery-base.mjs', 'delivery-migration-order.mjs',
  'ui-transport.mjs', 'workspace-scope.mjs', 'dashboard-styles.mjs', 'login-return.mjs', 'abuse-limits.mjs', 'widget-rate-limit.mjs', 'local-agent-archive.mjs', 'reproducible-output.mjs', 'widget-transport.mjs', 'widget-connection-recovery.mjs',
  'project-verification-secret.mjs', 'widget-settings-model.mjs', 'identity-setup-deployment.mjs', 'security-headers.mjs', 'search-codec.mjs', 'delegation-documents.mjs', 'user-agent-parser.mjs', 'inbox-search.mjs', 'contact-timezone.mjs', 'saved-reply-insertion.mjs',
].map(name => `tests/${name}`);
const groups = ['scripts/edition-authoring', 'tests/ai-support', 'tests/customer-context', 'tests/eval-harness', 'tests/training', 'local-agent/test', 'live-proofs/tests', 'tests/live/recorder'];
async function collectTests(group){
 const entries=await readdir(new URL(`../${group}/`,import.meta.url),{withFileTypes:true});
 for(const entry of entries){const path=`${group}/${entry.name}`;if(entry.isDirectory())await collectTests(path);else if(/\.test\.(?:mjs|cjs|js)$/.test(entry.name))standalone.push(path);}
}
for(const group of groups)await collectTests(group);
// Export runner arguments for callers inspecting the selected portable tests.
export const moduleTestArgs = ['--test', '--test-concurrency=2', ...standalone.sort()];
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const child = spawn(process.execPath, moduleTestArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
