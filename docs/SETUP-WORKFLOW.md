# First-run setup

Prepare the first owner through [Install](INSTALLER.md), using
`node scripts/rer.mjs setup --owner-email you@example.com --answers .seed/local-answers.json`.
Setup creates the native owner and first workspace before it exits. Start with
`node scripts/rer.mjs dev` and sign in through the printed development outbox.
The owner decision retains native passwords, prior account/workspace data and
HappyToHelp's own tenant/permission checks.

## Do you need this page?

Use this guide for the in-app **Setup** checklist and the native first-owner
boundary. A rer local installation already has an owner. An existing installation
never creates another owner through setup. A remotely deployed empty installation
has a private first-owner setup capability; use its native `/setup` page over the
configured HTTPS origin. Keep the capability private and enter it only in the
owner form. It is not a sign-in shortcut and is closed permanently after claim.

## Create your owner account and workspace

Local setup reads the manifest's workspace name, owner name/email/password,
widget website and brand colour from the private answers. Native bootstrap
checks origin, validates inputs and claims the first owner atomically. Failed
claims do not leave partial credentials or memberships. Concurrent claims cannot
create two owners. Imported identity state also closes first-owner setup.

On an empty hosted installation, enter the private setup token in the native
form along with those details. Keep tokens and passwords out of shell arguments,
URLs, recordings and logs. Sign in with the native password after claim.

### The widget website origin

The website hosting the widget is separate from the HappyToHelp app origin.
Supply an exact HTTP(S) origin: scheme and hostname, with an explicit port when
needed, but no path, query, credentials or fragment. The widget is admitted only
on the saved origin. Configure it through **Settings → Widget**; do not expose
an operator token or the server verification secret to customer code.

## After setup

Sign-in opens the workspace's **Setup** checklist. It records eight explicit
observations: owner test mail, sender DNS, inbound receipt, model access, spend
ceilings, a published article, saved widget origin and an authenticated widget
visit. Defaults and saved configuration do not assert successful delivery or
provider execution. GET inspection performs no provider work. Only the owner's
explicit test-mail action may send to that owner's mailbox; uncertain work is
never replayed automatically.

Ordinary workspace creation starts with the widget snippet. **Advanced** holds
server secrets and verification examples. Empty inbox actions offer widget
installation, a real test conversation and a separate demo; demo content is
explicit and never replaces customer data. See [Workspace workflows](WORKSPACE-WORKFLOWS.md).

## Local sign-in and private state

Only explicit trusted local configuration selects development mail. The outbox
is loopback-only, escaped and non-cacheable; it stores sensitive local captures.
Production has neither this sender nor viewer. Failed real delivery never falls
back to capture. Open the newest message from `node scripts/rer.mjs outbox` while
dev is running, follow its link and press **Sign in**. No email is sent.

Stop dev before reset/export/import. Use [Operations](../OPERATIONS.md#local-data-and-backups)
for confirmed reset and private backups. Re-running setup preserves existing
owners and settings; it never rotates secrets or erases data.
