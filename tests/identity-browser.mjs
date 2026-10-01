import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createRuntime } from './helpers/emitted-runtime.mjs';
import { createKit } from './helpers/identity-browser-kit.mjs';
import { checkAfterSetup, checkForgotPasswordWithoutEmail, checkFreshInstall, checkInvitationAcceptance, checkLinkProblems, createOwner } from './helpers/identity-browser-default.mjs';
import { checkPendingInvitationsWithEmail, checkPendingInvitationsWithoutEmail } from './helpers/identity-browser-invitations.mjs';
import { checkForgotPasswordWithEmail, checkRegistrationBeforeSetup, checkRegistrationOpen, checkResetPassword, checkVerifyEmail } from './helpers/identity-browser-email.mjs';

// Public identity pages and pending invitations, in a real browser against two emitted Workers: the default
// deployment (sign-up off, no email) and one with sign-up on and a mail provider configured. No mail is ever sent.
// H2H_TEST_PORT fixes the first Worker's port (its inspector takes the next one) and the second Worker uses the two after.
const evidenceDir = join(process.env.H2H_EVIDENCE_DIR ? resolve(process.env.H2H_EVIDENCE_DIR) : await mkdtemp(join(tmpdir(), 'h2h-identity-browser-')), 'identity');
await mkdir(evidenceDir, { recursive: true });
const port = Number(process.env.H2H_TEST_PORT) || 0;
// H2H_IDENTITY_PARTS=default or =email runs one Worker's checks while iterating; both run by default.
const parts = new Set((process.env.H2H_IDENTITY_PARTS || 'default,email').split(','));
const errors = [];
let browser, success = false, kit;
// The two Workers run one after the other: two Wrangler processes with the same Worker name wait on each other.
const withRuntime = async (options, work) => {
    const runtime = await createRuntime(options);
    let passed = false;
    try { await work(runtime); passed = true; } finally { await runtime.close(passed); }
};
try {
    browser = await chromium.launch({ headless: true, ...(process.env.H2H_BROWSER_CHANNEL ? { channel: process.env.H2H_BROWSER_CHANNEL } : {}) });
    kit = createKit({ browser, evidenceDir, errors });

    // Default deployment.
    if (parts.has('default')) await withRuntime({ port }, async runtime => {
        const context = { origin: runtime.origin, kit, runtime };
        await checkFreshInstall(context);
        await checkForgotPasswordWithoutEmail(context);
        const owner = await createOwner(context);
        await checkAfterSetup(context);
        await checkLinkProblems(context);
        const { operator } = await checkInvitationAcceptance(context, owner);
        const operatorLogin = await kit.api(runtime.origin, '/api/identity/login', { body: { ...operator, projectId: owner.projectId } });
        await checkPendingInvitationsWithoutEmail(context, owner, { token: operatorLogin.json.token });
    });

    // Sign-up on, email configured.
    const emailVars = { REGISTRATION_ENABLED: 'true', EMAIL_API_KEY: 'fixture-key-never-sent', EMAIL_FROM: 'HappyToHelp <support@example.test>', APP_ORIGIN: 'http://localhost' };
    if (parts.has('email')) await withRuntime({ port: port ? port + 2 : 0, inspectorPort: port ? port + 3 : undefined, vars: emailVars }, async runtime => {
        const context = { origin: runtime.origin, kit, runtime };
        await checkRegistrationBeforeSetup(context);
        const created = await kit.api(runtime.origin, '/api/identity/bootstrap', { body: { name: 'Lantern Works', ownerName: 'Casey Owner', email: 'casey@review.test', password: 'lantern-owner-pass-1', allowedOrigin: 'https://lantern.example' } });
        assert.equal(created.status, 201, created.text);
        const owner = { projectId: created.json.projectId, token: created.json.token };
        await checkRegistrationOpen(context);
        await checkForgotPasswordWithEmail(context);
        await checkResetPassword(context, owner);
        await checkVerifyEmail(context);
        await checkPendingInvitationsWithEmail(context, owner);
    });

    assert.deepEqual(errors, [], 'no page or console errors');
    success = true;
} finally {
    await writeFile(join(evidenceDir, 'result.json'), JSON.stringify({ success, checks: kit?.checks ?? [], errors }, null, 2)).catch(() => {});
    console.log(JSON.stringify({ success, checks: kit?.checks ?? [], errors }, null, 1));
    await browser?.close();
}
