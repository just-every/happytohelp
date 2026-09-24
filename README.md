# HappyToHelp

This repository owns the HappyToHelp application on the maintained RER runtime:
TanStack Start/React documents, Hono HTTP, Cloudflare Workers, D1, R2, Queues and
conversation Durable Objects. It ports the existing HappyToHelp dashboard,
customer widget, chat, delegation and knowledge architecture into native source.
The public root is the owner-approved village homepage with dynamic published
help centers. Its 12ui-converted artwork moves from a beacon-lit mountain
procession into the conversation square, knowledge archive, agent handoff and
open workshop. Pricing, legal, waitlist, referrer and public auto-widget behavior remain outside the active scope. The earlier
small RER delegation desk remains in Git history; its family publisher is retired.

## Current public-root scope — 22 September 2026

The owner approved the village page as the real public root, replacing the earlier
journey artwork. It retains the exact “Support. Free. Yours.” introduction, real
source/documentation links and native setup, login and workspace destinations.
The implementation and local verification are recorded in HANDOVER.md. Hosted and
provider acceptance remain separate; this homepage change is not a deployment.

Read ACCEPTANCE.md, CONTRACT.md and OPERATIONS.md for the product and operating
requirements. The current implementation/verification boundary belongs in the
handover and evidence, not in a source manifest.

Start a fresh checkout with `node scripts/install.mjs`; see the
[standalone installer](docs/INSTALLER.md). For the manual development path:

```sh
node scripts/operations.mjs describe
node scripts/edition-authoring/cli.mjs inspect
pnpm install --frozen-lockfile
pnpm run setup -- --local
pnpm run dev
```

Open `/setup` after starting the local app to create the first owner with an
email and password. Setup then closes; use `/login` for subsequent access.
The dev command builds the customer widget and local-connector download before starting
Vite, so a fresh checkout serves these assets too.

`pnpm run setup`, `pnpm run build`, `pnpm run verify`, `pnpm run deploy` and `pnpm run source:release`
are the common edition commands. Setup/deploy have external effects described in
OPERATIONS.md. Configure only the providers/bindings the selected product needs;
missing provider configuration is an explicit unavailable result, never fabricated
success. Local build/test results do not establish deployed or paid-provider proof.

All files remain editable authoring inputs. Every selected component, including
Base runtime and authoring tooling, is retained locally in this edition. Normal
installation and development need no sibling Base, family or original HappyToHelp
checkout. External origins record comparison ancestry. `edition.json` identifies
selected components without regenerating product code. See
[MODULES.md](docs/MODULES.md) for reusable capabilities, dependencies and concrete
entry points, [AUTHORING.md](docs/AUTHORING.md) for the common source lifecycle,
and [SOURCE-PROVENANCE.md](docs/SOURCE-PROVENANCE.md) for origins and retained notices.

The source lock is generated only after the integrating owner freezes and stages
the intended inputs. Until that point, an inspected recipe is not a passing
source-integrity check or a portable release. Publication and deployment are
separate explicitly authorized actions.

## Explore a fictional demo inbox

An owner looking at a completely empty project inbox can choose **Try a demo
inbox**. This creates a separate **Demo inbox · Northstar Outfitters** project
with eight curated fictional conversations, including six ten-message stories: product advice, delivery follow-up,
CSV import help, a feature request, a receipt explanation and a resolved care
question. Two longer group-hike and damaged-strap histories add consecutive
customer/team message runs, grouped page visits, internal notes, a human assignment
and an earlier session separated by two days. These use the actual persisted
tracking and transcript paths. Contacts and the inbox are labelled as demo content. The stories are
persisted ordinary conversations, so views, assignment, replies and reload work
normally. Open, assigned, unassigned and closed views reflect those real records.
Creation also adds an editable drafting assistant and three published fictional
FAQ articles. **Generate replies** uses the normal configured provider to produce
real suggestions for review; it does not send a customer reply. No AI execution,
provider calls, emails or notifications occur during creation.

Repeated requests reuse your existing demo without resetting edits. Older untouched
short demo transcripts gain the extended conversations; edited or replied-to
conversations are left as they are. Other owners
get their own demo. You can remove it through normal project settings deletion;
this retains deleted history under the existing deletion policy. A later request
creates a fresh demo project. Your original project's records are never changed.

For the scenic first-owner flow and nonsecret agent prefill handoff, see
[First-run setup](docs/SETUP-WORKFLOW.md).

Start a fresh checkout with `node scripts/install.mjs` — the
[standalone installer](docs/INSTALLER.md) opens before app dependencies or builds.
The native `/setup` page is the fallback for an already running installation.
