# Public landing and Help Center

The public homepage is a native TanStack Start/React route in `src/routes/index.tsx`,
composed from `src/ui/homepage` and the approved assets in `public/homepage`.
It retains links to native workspace, setup and login. This module serves dynamic,
project-scoped published help centers. Former pricing, resources, legal, waitlist,
referrer-personalized and public homepage-widget behavior remains retired. The
customer support widget remains an independent owner-configured product surface
served from its own `/widget.js` build.

`index.ts` dispatches the canonical help-center routes; `/` belongs to the native
React router.
`help-center.tsx` preserves `/{project}/search?keyword=...`,
`/{project}/{article_slug}` and `/help/{project}` aliases. Only persisted project
IDs or explicitly granted slugs resolve. Project owners/admins can claim an
unused slug via PUT `/api/public-site/projects/:projectId/alias`; reserved app
paths cannot be claimed. Published project-scoped articles are rendered with the
maintained Markdown renderer (raw HTML disabled), and draft/deleted projects stay
private. The importer maps retained legacy project slugs into
`public_project_aliases` when preserving old help links.

Knowledge provider imports (Intercom, Freshdesk and Zendesk) remain in the
knowledge capability and write only through its scoped, durable import jobs.
They are independent of the public landing page. Authenticated owner/admin site
previews use the site-preview capability and its separate origin; retired public
demo/trial creation is not part of this module.

No public route initializes an operator token, widget secret or tracking ID.
Missing configuration returns an explicit unavailable state. The Help Center
shell uses the first-party stylesheet at
`public/site-assets/help_center/css/app.css`; the former copied theme and
pattern inputs were removed after an active-reference audit. Inspect
`docs/PUBLIC-SOURCE-PROVENANCE.md` before redistribution. Pruning assets does
not establish blanket rights clearance.

Validation must target the current landing/help-center route inventory. Historical
marketing, waitlist and referrer receipts remain in Git for comparison and are not
current product acceptance.
