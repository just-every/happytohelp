# HappyToHelp native operations

This edition replaces the PHP application with TanStack Start/React, Hono and a
Cloudflare Worker. D1 (`DB`) stores application records and operation state, R2
(`FILES`) stores retained content/media, Queues (`JOBS`) dispatch persisted work,
and a SQLite Durable Object (`CONVERSATIONS`) coordinates sockets. The minute
cron recovers eligible persisted work. No PHP, Laravel, MySQL, Redis, Lambda or
API Gateway service is required by the delivered runtime.

Before dependencies, run `node scripts/operations.mjs describe` and `check` from
this repository. They read files and validate declared local configuration only;
they do not execute setup/deploy, inspect secrets, log in or prove remote health.
Use Node 26.8.1 or newer and the lockfile's pnpm workflow. Use `pnpm run setup`:
`pnpm setup` is pnpm's own unrelated command.

## Clean owner installation

1. Run `pnpm install --frozen-lockfile` in the edition/released source directory.
2. Run `pnpm run setup -- --local`. This collects edition and module migrations
   into `.generated/migrations` and applies local D1 migrations. It does not
   provision remote resources or publish code.
3. If optional runtime configuration is needed, create a private `.dev.vars`
   file for those values. Run `pnpm run dev`, open `/setup`, and choose an email and password to establish
   the first owner. Setup closes once an owner exists; subsequent access uses
   `/login`. Dashboard routes include `/projects` and `/conversations`; `/` is
   the original public marketing site. Configure the project's exact widget
   allowed origin, then install its native widget key/API-origin snippet.
4. `pnpm run verify` executes the repository's declared verification command.
   `scripts/verify-modules.mjs` and individual `tests/` suites provide the
   capability evidence listed in ACCEPTANCE.md. Provider fixture tests never
   establish live-provider success. Use `pnpm run deploy -- --local` for a fresh
   build, local migration application and Wrangler packaging dry run.

Do not overwrite applied SQL history. Add a uniquely numbered migration in the
edition or selected module, run `pnpm run migrations:prepare`, and apply it using
the same setup target. Generation removes obsolete generated copies; it does not
rewrite D1's applied history. Back up owned data before consequential migrations.

## Remote setup and publication

Set `CLOUDFLARE_ACCOUNT_ID`, `H2H_RESOURCE_PREFIX` and `H2H_PUBLIC_ORIGIN` in the
invoking environment, and authenticate Wrangler using its supported login/token.
`pnpm run setup -- --plan` validates the target and prints resource names only.
`pnpm run setup -- --remote` discovers/creates D1, R2 and primary/dead-letter
Queues, records the selected bindings/routes in private
`.seed/deployment/<prefix>/wrangler.json`, and applies remote D1 migrations. This
changes remote resources and data schema but **does not publish Worker code**.

`pnpm run deploy -- --remote` requires that exact setup target, collects migrations,
builds its Worker, checks emitted target identity, applies migrations, supplies
configured secret bindings through a temporary mode-0600 JSON file, publishes the
Worker/assets, removes the temporary file and probes native resource health.
The secret file is never a source artifact or CLI argument containing values.
Changed public variables require setup again. Unspecified existing cloud secrets
are not an explicit revocation; rotate/delete credentials through Wrangler when
intended. No deployment was performed by these documentation/configuration changes.

`GET /health` returns native runtime plus D1 and R2 reachability, or HTTP 503.
It does not establish Queue delivery, sockets, tenant behavior, provider budgets,
email receipt, commercial billing, GitHub access or live model quality. Verify the
actual deployed digest/route and those selected journeys separately.

## Optional native capabilities

Runtime variable and secret allowlists are maintained in
`scripts/deployment/environment.mjs`; setup carries variables into the remote
configuration and deploy carries supplied secrets privately. Local `.dev.vars`
accepts the same runtime names. Omitted providers fail explicitly at their call
boundaries; the application never invents answers or reports fake delivery.

| Capability | Public/runtime configuration | Private secret bindings |
| --- | --- | --- |
| Owner access and registration | `APP_ORIGIN` (remote setup derives it), `REGISTRATION_ENABLED` | Optional `TURNSTILE_SECRET`; registration/recovery need the email configuration |
| Ensemble reply, assist, profiles and monitoring | Models selected in project/AI configuration; `CONTEXT_MODEL` for widget-triggered context work | Selected `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY` |
| Knowledge crawl and semantic search | `APIFY_CRAWLER_ACTOR_ID`, `QDRANT_URL`, `KNOWLEDGE_EMBEDDING_MODEL` | `APIFY_TOKEN`, `QDRANT_API_KEY`, `OPENAI_API_KEY`; supplied-content lexical retrieval does not require these providers |
| Help-center provider import | Explicit platform/subdomain and destination project per import | `INTERCOM_TOKEN`, `FRESHDESK_TOKEN`, `ZENDESK_TOKEN`/`ZENDESK_EMAIL` for the selected provider |
| Email and waitlist | Project email settings; native inbound endpoints | `EMAIL_API_KEY`, `EMAIL_FROM`, `WAITLIST_NOTIFY_EMAIL`, `INBOUND_EMAIL_TOKEN` |
| Billing | Project billing settings, `BILLING_CURRENCY` and explicit amounts/costs | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Lead research and reviewed outreach | `LEAD_MODEL`; persisted lead review before sending | `OPENAI_API_KEY`, selected email configuration |
| GitHub | `GITHUB_CLIENT_ID`, optionally `GITHUB_PROJECT_ID` for one fixed credential | `GITHUB_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`; optional `GITHUB_TOKEN` or JSON `GITHUB_TOKENS` map keyed by project ID |
| Brand image generation | Explicit `BRAND_IMAGE_MODEL`, `BRAND_IMAGE_SIZE`, `BRAND_IMAGE_QUALITY` | `OPENAI_API_KEY` |
| Public website preview | `PREVIEW_ORIGIN` distinct from `APP_ORIGIN`, opt-in `PUBLIC_DEMO_ENABLED=true` | None; preview grants enforce scope, expiry and request limits |
| Public marketing widget | `PUBLIC_WIDGET_PROJECT_ID` resolving an active native project | None; only its public widget key reaches the browser |
| Training/evaluation | Explicit model/budget per run; `TRAINING_PRICE_CEILINGS` JSON model map of positive `inputPerMillion`/`outputPerMillion`; local-only `ENABLE_SYNTHETIC_EVALUATION=true` for synthetic test admission | Selected model provider credential |

Preview uses a separate custom hostname mapped to this Worker during remote
setup; it cannot share the application's origin. Do not run untrusted proxied
pages under the owner-session origin. `INTEGRATION_ENCRYPTION_KEY` is base64 encoding of 32 random bytes; do not
rotate it without migrating encrypted stored connections. GitHub OAuth redirects and Stripe/inbound
webhooks must be configured with the actual deployed native URLs. Local computer
work additionally requires the separately packaged connector, fresh device
pairing and the exact delegated grant; it is not a Worker subprocess.

## Existing data and source custody

`node scripts/import-legacy.mjs --file /absolute/export.json` plans without writing.
Add `--apply --persist-to .wrangler/state` to import into the migrated local D1/R2
state. The importer is local-only and does not read a production database. Use a
consistent, explicitly selected legacy export with exact IDs, decimal money and
retained object bytes/hashes; see `src/modules/legacy-import/README.md`.

Import batches are incrementally resumable by artifact SHA and per-row receipts,
not whole-database atomic. Re-running the same artifact skips committed rows;
conflicting canonical rows/objects stop without overwriting. Inspect
`legacy_import_rows`, run records and `legacy_import_holds`: archive-only rows do
not imply normalized live behavior, and ambiguous generation/training/billing
requires reconciliation before any new provider attempt. No imported old session,
password token or device grant becomes trusted native authority.

Use the edition's `source:inspect`, `source:check`, `source:lock` and
`source:release` commands for source authoring/release custody. No original
HappyToHelp checkout is regenerated or erased. Marketing HTML/assets are owned
editable source; review `docs/PUBLIC-SOURCE-PROVENANCE.md` before redistribution.
A portable source release, local checks and importer fixtures do not themselves
establish a deployed product, production-data migration or asset licence clearance.
