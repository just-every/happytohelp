# First-run setup

The native `/setup` route uses the approved Ocean Cliffs design. It creates an
owner account and workspace together, stores the selected workspace colour and
widget origin, authenticates the browser, and opens the real widget settings.
Existing, imported and deleted installations cannot reopen first-owner setup.
The runtime and current installation shown at left describe the running app;
they do not assert a Cloudflare or GitHub account connection.

## Agent-assisted handoff

Prepare the installation through the existing documented operating commands:
`pnpm run setup -- --local` for local bindings, or the reviewed remote setup/deploy
commands in OPERATIONS.md. The Run Edit Run managed service owns its existing
repository, Cloudflare and installation provisioning flow. This edition wizard
finishes owner/workspace setup after the Worker is running.

An agent can check the live setup state and produce an editable browser handoff:

```sh
node scripts/setup-link.mjs --url http://localhost:5174 --ownerName 'Alex' --email 'alex@example.com' --name 'Alex’s team' --allowedOrigin https://example.com --primaryColor '#7c3aed'
```

The command reads availability and outputs a link; it does not create accounts,
connect providers, deploy, or invite anyone. Only explicit nonsecret values enter
the URL fragment, which the page removes immediately. Do not include passwords
or setup tokens in command arguments. Enter those in the form. An installation
deployed with `H2H_SETUP_TOKEN` asks for that token before creating the owner,
and one deployed with `H2H_SETUP_OWNER_EMAIL` accepts only that owner email.
Only loopback development (`localhost`, `127.0.0.1` or `[::1]` with no public
`APP_ORIGIN`) may create the owner without a token. Anywhere else, including
hosted Assisted and Managed installations, the Worker answers owner setup with
HTTP 503 until a token is configured, and `pnpm run deploy -- --remote` refuses
to publish a fresh installation without one.

The browser saves only owner name/email, workspace name, widget origin and colour
in this tab's session storage. Password and token remain in memory and must be
entered again after reload. Back and Edit permit review; final submission checks
all stages and the server validates everything again. Completion clears the draft.

After creation, widget settings provide the real installation snippet and preview.
Use existing workspace settings for knowledge, AI configuration and team access;
this flow makes no external provider calls or invitation sends.

## Verification

`pnpm run test:setup-browser` starts a fresh emitted Worker and isolated storage.
It checks fragment handoff and draft resume, no stored password, password
validation, atomic account creation, actual widget preview, session reload,
subsequent password login and completed-setup refusal. `tests/identity-setup.mjs`
checks atomicity, branding/name persistence and first-owner protection in real D1.
