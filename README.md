# HappyToHelp

This repository owns the HappyToHelp application on the maintained RER runtime:
TanStack Start/React documents, Hono HTTP, Cloudflare Workers, D1, R2, Queues and
conversation Durable Objects. It ports the existing HappyToHelp dashboard, widget,
chat, delegation and knowledge architecture into native source. The earlier small
RER delegation desk is a separate legacy product input, not this application.

Read ACCEPTANCE.md, CONTRACT.md and OPERATIONS.md for the product and operating
requirements. The current implementation/verification boundary belongs in the
handover and evidence, not in a source manifest.

```sh
node scripts/operations.mjs describe
node scripts/edition-authoring/cli.mjs inspect
pnpm install --frozen-lockfile
pnpm run setup -- --local
pnpm run dev
```

`pnpm run setup`, `pnpm run build`, `pnpm run verify`, `pnpm run deploy` and `pnpm run source:release`
are the common edition commands. Setup/deploy have external effects described in
OPERATIONS.md. Configure only the providers/bindings the selected product needs;
missing provider configuration is an explicit unavailable result, never fabricated
success. Local build/test results do not establish deployed or paid-provider proof.

All files remain editable authoring inputs. `edition.json` identifies selected
components without moving them or regenerating product code. See
[MODULES.md](docs/MODULES.md) for reusable capabilities, dependencies and concrete
entry points, [AUTHORING.md](docs/AUTHORING.md) for the common source lifecycle,
and [SOURCE-PROVENANCE.md](docs/SOURCE-PROVENANCE.md) for origins and retained notices.

The source lock is generated only after the integrating owner freezes and stages
the intended inputs. Until that point, an inspected recipe is not a passing
source-integrity check or a portable release. Publication and deployment are
separate explicitly authorized actions.
