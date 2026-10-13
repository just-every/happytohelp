# First-run setup

Prepare the first owner through [Install](INSTALLER.md), using
`node scripts/rer.mjs setup --owner-email you@example.com --answers .seed/local-answers.json`.
Setup creates the native owner and first workspace before it exits. Start with
`node scripts/rer.mjs dev` and sign in through the printed development outbox.
The owner decision retains native passwords, prior account/workspace data and
HappyToHelp's own tenant/permission checks.

## Do you need this page?

Use this guide for the one-screen first run, the in-app **Setup** page and the native first-owner
boundary. A rer local installation already has an owner. An existing installation
never creates another owner through setup. A remotely deployed empty installation
has a private first-owner setup capability; use its native `/setup` page over the
configured HTTPS origin. Keep the capability private and enter it only in the
owner form. It is not a sign-in shortcut and is closed permanently after claim.

## Create your owner account and workspace

First-run setup is one screen: your email, a password, your website and, on a
hosted installation, the private setup token. Local setup takes the same
answers from the private file; only the website and the owner password are
required, and the owner email comes from the command. Anything you do not give is
derived: the workspace name from your website (or your company email domain), your
name from your email and a default colour. Each can be changed afterwards. Native
bootstrap checks origin, validates inputs and claims the first owner atomically.
Failed claims do not leave partial credentials or memberships. Concurrent claims
cannot create two owners. Imported identity state also closes first-owner setup.

On an empty hosted installation, enter the private setup token in the native
form. Keep tokens and passwords out of shell arguments, URLs, recordings and
logs. Sign in with the native password after claim.

Pressing **Create workspace** is your explicit action, and it may send you one
welcome email at the address you gave. It goes through the same durable send path
as every other mail, so it is never sent twice, and a send whose outcome is
unknown is reported as unknown and never replayed. Locally the message lands in the
development outbox and is described as captured, never delivered. Setup succeeds
whatever happens to that email.

### The widget website origin

The website hosting the widget is separate from the HappyToHelp app origin.
Supply an exact HTTP(S) origin: scheme and hostname, with an explicit port when
needed, but no path, query, credentials or fragment. The widget is admitted only
on the saved origin. Configure it through **Settings → Widget**; do not expose
an operator token or the server verification secret to customer code.

## After setup

The workspace is already set up when you arrive. Every new workspace (the first
owner's, one created while signed in and one created by email-verified
registration; never a demo workspace) is provisioned in one step with:

- a starter assistant, "Support assistant", as the default visitor assistant. It
  answers visitors by itself from the help articles you publish and from what we
  read on your website, within the daily AI ceilings, once an AI provider key exists on the installation. With no key, no
  assistant is assigned to a new conversation, so it stays with your team and
  nothing fails or pretends to succeed. The AI page and Setup say a key is missing
  and which secret it needs. The key is an installation secret: add it to `.dev.vars`
  locally, or as a Worker secret, as in [Install](INSTALLER.md#private-setup-answers)
  and the README's [AI replies](../README.md#set-up-ai-replies) section;
- a reply-by-email mailbox, when the installation holds `INBOUND_EMAIL_TOKEN`,
  on `in.` plus your website's host or on `INBOUND_EMAIL_DOMAIN`;
- the installation sender for mail, until your own sending domain is verified,
  and then your own address;
- a one-time read of your website that keeps up to eight of its pages as private
  knowledge your assistant can answer from, and may fill in your name and colour
  while you have not changed them. It runs once, it is best effort (a site that
  cannot be read leaves nothing and no error), and it publishes nothing: no article
  is written and none is public. Existing drafts from earlier reads are left as
  they are.

Sign-in opens the workspace's **Setup** page: **Needs you** lists only what cannot
be done for you, widget first (adding the widget to your website), then connecting
an AI service and, with a hosted email provider, the DNS records for your sending
domain. **What we've set** lists the rest, each with a **Change** link. The system
runs its own checks while the page is open: observations of mail to you, sender
DNS, inbound receipt, model access, spend ceilings, saved widget origin and an
authenticated widget visit. A published help article is not one of them: the
assistant also answers from your own site, so the article step is hidden and never
counts. The page counts what is confirmed against what can be confirmed on this
installation ("N of M confirmed"). Defaults, presets and saved configuration do
not count; a step is confirmed only when it is observed.

Each item under **Needs you** has **Skip for now**, for something you do not want
to do yet, such as connecting an AI service. A skipped item moves to **Skipped**,
with **Undo**, and leaves the count: M shrinks by one, and the heading reads "All
set" once nothing is left under **Needs you**. A skipped item is never shown as
confirmed. The skip is kept by the server for the workspace (not in your browser),
so it lasts a reload and a new sign-in; only an owner or admin can make it, and it
contacts no provider and sends no mail. If you skip something and it is later
observed (the widget is seen on your site, a working key is added), it shows as
confirmed and counts. A key the provider rejects stays under **Needs you**, because
a problem is not hidden by a skip.

Mail to you is confirmed by using an emailed sign-in link, or by the provider's
reported outcome for the welcome email or the test you send from the Email page
(**Send me a test**). Provider acceptance is pending, and local capture is never
delivery. GET inspection performs no provider work. The page's own checks read
metadata and DNS, never send mail and never request a generation. Only your
explicit action sends mail, to your own mailbox; uncertain work is never replayed
automatically. See [the activation module](../src/modules/management/activation/README.md)
for the shape of the snapshot and the freshness windows.

Ordinary workspace creation starts with the widget snippet. **Advanced** holds
server secrets and verification examples. Empty inbox actions offer widget
installation, a link to Setup and a separate demo; demo content is
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
