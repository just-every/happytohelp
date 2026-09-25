# Candidate deployment declarations

`build-delivery-artifact.mjs` packages `deploymentSpec` alongside Worker modules
and assets. The emitted Wrangler configuration supplies the actual candidate
bindings, compatibility flags, Durable Objects, schedules and queue consumers.
D1 SQL is read with native migration names and exact SHA-256 digests. Provider
resource names and account IDs are omitted; the broker assigns installation
identities, retains applied migration history and keeps owner initialization.

When adding a public configuration default, declare its name in `spec-inputs.mjs`
and its value in source Wrangler configuration. Add required secret names to
`secretNames`, or optional capabilities to `optionalSecretNames`. Values belong
only in the broker secret store; never commit them or inject them into the build.
A new BCC setting, for example, must declare its own binding in that candidate's
inputs as well as implementing the mail behavior and any database migration.
Run the producer from the candidate checkout so its declarations are selected.

Unsupported Durable Object migration forms fail explicitly until the broker
contract supports them. A built artifact is reviewed data, not deployment authority.

## Reproducible artifacts

The artifact bytes depend only on the committed source and lockfile, not on the
checkout's absolute path, build time, locale or host. Artifact files are ordered
by code unit. The Vite build rewrites TanStack Start's route source paths
relative to the project root and fails if an emitted chunk names the build
directory. The local connector download is a normalized tar (sorted entries,
numeric root owner, 0644/0755 modes, npm pack's fixed 1985-10-26 timestamp) in a
gzip stream without a timestamp. Build with the same Node and pnpm versions as
`package.json` declares; a different Node release can compress differently.

`pnpm run test:reproducible-build` copies the working tree to two unrelated
temporary paths, installs each offline from the pnpm store with the frozen
lockfile, builds and emits both artifacts, and requires equal SHA-256 digests and
no builder, repository, temporary or home directory path in any module or asset.
It takes about 90 seconds and runs in the delivery workflow; it is not part of
`pnpm run verify`.

## Provider effects in controlled previews

`spec-inputs.mjs` declares the complete static `providerEffects` list, including
optional or currently disabled capabilities. The artifact carries these exact
IDs through `deploymentSpec`:

| ID | Potential effects |
| --- | --- |
| `ai` | All configured AI, embeddings, image generation and lead providers |
| `outbound-mail` | Resend, Cloudflare and SendGrid mail |
| `knowledge-crawl` | Apify crawling and datasets |
| `knowledge-vector-store` | Qdrant vector storage |
| `support-imports` | Intercom, Freshdesk and Zendesk imports |
| `github` | GitHub OAuth, API and repository access |
| `website-fetch` | Public website and lead preview requests, and DNS fetches |
| `turnstile` | Turnstile verification |

The preview owner must assert each effect is isolated through controlled
accounts, credentials, recipients, destinations and data, or is disabled. The
service requires these exact IDs in `controlledProviders`. These declarations
are not proof of provider sandboxing and do not enable, configure or exercise
any provider themselves.
