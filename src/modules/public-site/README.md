# Public site and Help Center

Native editable HTML retains the original HappyToHelp marketing, pricing,
resources, legal and waitlist documents, CSS, images and current browser chunks.
The 16 documents were rendered once from the read-only HappyToHelp site in an
isolated temporary Laravel application with no `.env`, array session/cache and
local URLs. Laravel/PHP is not a build or runtime dependency of this edition.
Each document is ordinary editable source; no regeneration of owner edits occurs.

`index.ts` serves `/`, `/marketing`, the original section URLs and the waitlist.
The root integration dispatches only recognized public paths before TanStack.
Original `/features` and `/features/billing` target missing source views and are
not invented here. The `/demo` route integrates the native site-preview module. It requires
explicit public-demo enablement and a separate preview origin; otherwise it
returns an explicit unavailable state. Marketing claims/prices are retained source copy, not verified
commercial availability. Referrer-personalized hero copy and prioritized visitor labels use the native
`referrer.ts` source port, with original mapping/message tables in JSON. UTM,
tracking IDs, referrer parameters, HTTP referrer, industry and intent ordering
match 100 original-source cases; all visitor input is escaped.

`waitlist.ts` validates and persists real D1 records with cookie/form CSRF and a
five-per-hour source-address admission limit. Email is unique; persistence is
reported only after the SQL writer succeeds. No public listing exposes entries.
Waitlist notification uses the existing email adapter when `WAITLIST_NOTIFY_EMAIL`,
`EMAIL_API_KEY` and `EMAIL_FROM` are configured. Its durable delivery identity
prevents ambiguous replay. Without configuration its state is `not_configured`;
no email delivery is claimed. The owner can export
these records through D1; any future endpoint needs explicit administration auth.

`help-center.tsx` preserves `/{project}/search?keyword=...` and
`/{project}/{article_slug}` as well as `/help/{project}` aliases. Only persisted
project IDs or explicitly granted slugs resolve. Project owners/admins can claim
an unused slug via PUT `/api/public-site/projects/:projectId/alias`. Reserved app
paths cannot be claimed. Published project-scoped articles are rendered with the
maintained Markdown renderer (raw HTML disabled); category publication and draft
article exclusion remain effective. No customer articles or private fixtures
were copied. The importer must map legacy project slugs into
`public_project_aliases` when retaining original public links. Custom-domain
binding remains infrastructure configuration, not an implicit host-wide lookup.

`PUBLIC_WIDGET_PROJECT_ID` explicitly selects the native widget for public pages.
No original widget secret, account token or tracking identifier is initialized.
The native `/widget.js` is the only widget runtime path. Native installation
resources refer to it; operators must use their actual hosted origin when
installing it on other websites.

Validation: run `H2H_TEST_ORIGIN=http://... node tests/public-site-runtime.mjs`
against the migrated local Worker. `H2H_TEST_PROJECT_ID` adds public-project route
checks. This creates a synthetic waitlist record in the local test database.
