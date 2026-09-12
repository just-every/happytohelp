# Owner deployment

Run `pnpm run deploy -- --local` for local migrations, tests, build and a Wrangler
package dry run. This does not provision or deploy Cloudflare resources.

For remote setup and deployment, provide these values through the process
environment using your private credential manager, then run
`pnpm run deploy -- --remote`:

- `CLOUDFLARE_ACCOUNT_ID`: the explicit owner account.
- `CLOUDFLARE_API_TOKEN`: access to that account's Workers, D1 and custom domains.
- `H2H_DEPLOY_ENV`: lowercase environment slug, for example `production`.
- `APP_ORIGIN`: HTTPS origin on the owner's Cloudflare-managed custom domain.
- `H2H_BOOTSTRAP_TOKEN`: a private random first-owner authorization secret.
- `H2H_OWNER_EMAIL`, `H2H_OWNER_PASSWORD`, `H2H_OWNER_NAME`: intended owner identity.
- Optional `SENDGRID_API_KEY` and `MAIL_FROM`, supplied together for outbound mail.

The command validates configuration and runs typechecking/tests before provisioning.
It finds or creates `support-happytohelp-ENV-db` in the explicit account, obtains
its ID from Wrangler's structured list, and writes ignored configuration beneath
`.wrangler/h2h-deployment/ENV/`. Tracked `wrangler.jsonc` remains local-only. The
Vite build reads this generated config through `H2H_WRANGLER_CONFIG` and produces
`dist/server/wrangler.json`. The script validates the emitted account, database,
origin and domain before applying remote migrations and deploying that exact file.

Secrets are supplied using the Base private temporary JSON helper and Wrangler's
`--secrets-file`, then the temporary secret file is removed. Secrets are never
rendered into Wrangler configuration. The command checks `/health` for a bounded
30-second window, then bootstraps an empty installation or verifies the existing
owner by signing in. Existing credentials are never overwritten or rebound; a
mismatch fails and leaves the existing owner intact.

This sequence is resumable: named D1 is reused and migrations are tracked by D1.
If deployment succeeds but the response or health check fails, inspect the actual
deployment before rerunning. Do not delete the database or change the owner
credentials to bypass a failure. Optional email configuration is installed but
this deployment script sends no customer mail.

## Generic edition setup

Set `H2H_DEPLOY_MODE=remote` with the declared owner/account credentials for the Base CLI `--setup --deploy` flow. `pnpm run setup` finds or creates the named D1 database, writes ignored resource configuration and applies migrations; it publishes no Worker. `pnpm run deploy` builds, validates, publishes and initializes/verifies the owner. Both commands also accept explicit `-- --local` or `-- --remote`. Local setup creates private local configuration and applies local migrations only. The target is always explicit; no remote default is inferred.

## workers.dev or custom domain

`APP_ORIGIN` explicitly selects the route. For workers.dev it must be `https://support-happytohelp-ENV.ACCOUNT-SUBDOMAIN.workers.dev`, with ENV equal to `H2H_DEPLOY_ENV`. Setup reads the selected Cloudflare account’s Workers subdomain via its API and rejects a mismatch before any D1 provisioning. It then enables workers.dev and emits no custom-domain route. Other HTTPS hostnames select the existing custom-domain route and disable workers.dev; those require the owner’s actual zone/domain configuration. There is no route fallback.
