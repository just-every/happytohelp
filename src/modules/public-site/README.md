# Public landing and Help Center

The active public surface is a small local-owner landing page plus dynamic,
project-scoped published help centers. The former marketing, pricing, resources,
legal, waitlist, referrer-personalized homepage and public homepage-widget
surface is retired from this edition. The customer support widget remains an
independent owner-configured product surface and is served from its own
`/widget.js` build.

`index.ts` serves the owner landing page and the canonical help-center routes.
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
Missing configuration returns an explicit unavailable state. Source assets that
remain after marketing cleanup are ordinary editable inputs; inspect
`docs/PUBLIC-SOURCE-PROVENANCE.md` before redistribution. Pruning assets does not
establish blanket rights clearance.

Validation must target the current landing/help-center route inventory. Historical
marketing, waitlist and referrer receipts remain in Git for comparison and are not
current product acceptance.
