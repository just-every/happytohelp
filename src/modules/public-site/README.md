# Public homepage and Help Center

The public homepage is a native TanStack Start/React route in `src/routes/index.tsx`,
composed from `src/ui/homepage` (inline drawings, no raster images) and the favicon in
`public/homepage/media/brands`.
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
They are independent of the public homepage. Authenticated owner/admin site
previews use the site-preview capability and its separate origin; retired public
demo/trial creation is not part of this module.

No public route initializes an operator token, widget secret or tracking ID.
Missing configuration returns an explicit unavailable state. The Help Center
shell uses the first-party stylesheet at
`public/site-assets/help_center/css/app.css`; the original service's theme and
pattern files are not included. See `docs/PUBLIC-SOURCE-PROVENANCE.md` for asset
provenance and licences.

`tests/public-help-center.mjs`, `tests/public-site-runtime.mjs` and
`pnpm run test:public-help-center-browser` cover the current homepage and
help-center routes.
