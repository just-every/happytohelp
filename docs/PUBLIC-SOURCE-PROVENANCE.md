# Public assets and their provenance

Everything in this repository, including the artwork described below, is
released under the MIT licence in the root [`LICENSE`](../LICENSE). Bundled
third-party components keep their own licences, listed at the end of this page.

## First-party artwork and branding (MIT)

All of the following are owner-generated or owner-supplied and are covered by
the root MIT licence like the rest of the source:

- **Homepage drawings** (owner approval 2026-10-01, handoff-first order
  2026-10-01): the hero handoff (a conversation with its internal note beside
  the Local panel), the four product drawings, the widget offer, the New task
  form and the ownership checklist are first-party React components, HTML and
  inline SVG in `src/ui/homepage/drawings/` styled by
  `src/ui/homepage/drawings.css`. They were drawn as real DOM text from the
  owner-approved design direction and from this repository's own dashboard and
  widget components (labels, structure and states), not from screenshots; no
  screenshot is distributed. No raster image, third-party illustration or logo
  is used; Codex, Claude and Cloudflare are named in text only.
- **HappyToHelp mark**: `public/homepage/media/brands/happytohelp-favicon.png`
  (homepage favicon) and `public/img/icon.svg` (dashboard mark). The favicon's
  SHA-256, byte count and origin are recorded in
  [`src/ui/homepage/asset-provenance.json`](../src/ui/homepage/asset-provenance.json).
- **Installer and setup background**: `public/setup/ocean.webp` (SHA-256
  `a3dfb0d036ce7e773acdf1aaac2c3863cc4948f299c5bd0e6220a3d620165a09`,
  1,207,294 bytes, 3072x2048), used by the standalone installer and the in-app
  `/setup` page. It is a WebP delivery derivative (quality 95, full resolution)
  of the owner's 3072x2048 PNG source (SHA-256
  `9e76eb5c98d25004c5993171f83c2ed0ea069397a5456e7f09bbde0363f4b983`,
  14,184,241 bytes).

The homepage is an ordinary React route in `src/routes/index.tsx` built from the
components in `src/ui/homepage`. Its text and links are real DOM content, and
each drawing carries one accessible label; the only motion is a one-time
draw-in of the sketch marks, which reduced-motion preferences remove.
Its source and documentation links derive from the `repository` field in
`package.json`.

## First-party styles and generated files (MIT)

- **Dashboard styles** under `src/ui/dashboard/styles` (the entry
  `dashboard.scss` and the `foundation/` partials) and the component styles
  beside them are first-party, built on Bootstrap 5.3 (MIT). Their only
  third-party inputs are Bootstrap, the `feather-icons` package (MIT), the
  highlight.js `vs2015` code style (BSD-3-Clause) and Inter (SIL Open Font
  License 1.1). The public homepage uses Outfit instead (see below). No commercial theme, font or image is used; the removed files
  and their hashes are recorded in
  [`src/ui/dashboard/asset-provenance.json`](../src/ui/dashboard/asset-provenance.json).
- **Help Center stylesheet**: `public/site-assets/help_center/css/app.css` is a
  first-party replacement for the original service's public-site theme. The
  hashes of the retired theme and pattern files, and why they were removed, are
  recorded in [`src/modules/public-site/asset-provenance.json`](../src/modules/public-site/asset-provenance.json).
- **Generated at build time** and not committed: `public/widget.js` (the
  customer widget) and `public/downloads/happytohelp-local-agent.tar.gz` (the
  local agent, packaged from an explicit allowlist with no credentials or
  runtime state).

## Third-party components

| Component | Where | Licence and notice |
| --- | --- | --- |
| Outfit typeface (Copyright 2021 The Outfit Project Authors, <https://github.com/Outfitio/Outfit-Fonts>) | `public/fonts/outfit/`: the variable-weight latin and latin-ext WOFF2 files, copied unchanged from the npm package `@fontsource-variable/outfit` 5.3.0 (built from <https://github.com/google/fonts>) and declared in `src/ui/homepage/outfit.css`. The homepage serves them itself and makes no request to a font host. Chosen over Plus Jakarta Sans, Manrope, Urbanist, Figtree, Lexend, Albert Sans and Sora as the closest match to the approved headline by rendering them side by side | SIL Open Font License 1.1, `public/fonts/outfit/LICENSE.txt` |
| Inter typeface | `public/fonts/inter/` | SIL Open Font License, `public/fonts/inter/LICENSE.txt` |
| Feather icons (`feather-icons` 4.29.2, Cole Bemis) | npm package; its SVGs are inlined as CSS masks in the built dashboard stylesheet (`src/ui/dashboard/styles/foundation/_icons.scss`) | MIT, [`docs/licenses/FEATHER-ICONS.md`](licenses/FEATHER-ICONS.md) |
| Font Awesome Free | npm packages used by the widget and dashboard | MIT code and CC BY 4.0 icons, [`docs/licenses/FONT-AWESOME-FREE.md`](licenses/FONT-AWESOME-FREE.md) |
| Lobe Icons (Claude and Codex logo paths) | `src/ui/dashboard/components/LocalAgentGlyph.jsx` | MIT, [`docs/licenses/LOBE-ICONS.md`](licenses/LOBE-ICONS.md) |
| favcount 1.5.0 (Copyright 2013 Chris Hunt) | `src/ui/dashboard/favcount.jsx` | MIT, notice inline at the top of that file |
| Lucide reply icons | `src/ui/dashboard/components/reply-icons/` | ISC, `LUCIDE-LICENSE.txt` in that directory |
| Ensemble model runtime | `src/modules/ai-support/vendor/ensemble/` | MIT, `LICENSE`, `SOURCE.json` and `SOURCE.patch` in that directory |
| Run Edit Run Base | `src/base`, `scripts/edition-authoring`, `scripts/base-onboarding` | MIT, [`docs/licenses/base-MIT.txt`](licenses/base-MIT.txt) |
| npm dependencies | `package.json`, `pnpm-lock.yaml` | Each package's own licence |

No Font Awesome Pro package or asset is included.

## External requests

The homepage makes no third-party request: its Outfit font files are served
from `public/fonts/outfit/`. The customer widget loads Open Sans from Google
Fonts on the page that embeds it. The Help
Center stylesheet makes no external font or image request. The homepage does not
load the customer widget, analytics or any tracking script, and no public page
embeds an operator token, widget secret or tracking ID. The customer widget is a
separate asset (`/widget.js`) that each owner installs on their own website.
