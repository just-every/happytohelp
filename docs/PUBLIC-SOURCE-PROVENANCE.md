# Public-source custody review — 2026-09-14

Source: `/Users/zemaj/www/happytohelp-site`, read-only. Route inventory comes from
`routes/web.php`; original home/marketing/resource/legal/pricing templates and
shared layouts were rendered with neutral HappyToHelp branding in a temporary
application with no source `.env`. No original checkout, database, credentials,
customer content or history was copied. Native documents are editable HTML,
not Blade or retained PHP runtime wrappers. Asset original byte hashes and paths
are in `src/modules/public-site/asset-provenance.json` (namespacing changes to the
browser entry are intentional and mean its delivered hash differs).

The source contains Font Awesome Pro SVGs inline in marketing and sidebar
markup. Those SVGs are removed from the retained documents and replaced with a
plain decorative character; Free SVG license notices remain. The selected native
public module/assets have no remaining `Font Awesome Pro` or `Commercial License`
markers. This is a scoped lexical check, not a universal ownership attestation.

Selected Bootstrap CSS retains its MIT notice. Current compiled browser chunks
contain third-party libraries (Bootstrap/Popper, Three, highlight.js, Headhesive,
scrollCue and their dependencies); only current manifest assets are retained,
not hundreds of historical webpack chunks. Public Google Fonts CSS imports
remain external font requests. Author-created images/PDFs and original template
styles are preserved with hashes; the original checkout does not provide a
complete provenance/licence declaration for these assets. Public redistribution
must resolve those rights and retain dependency licence notices before release;
this local source port does not assert clearance. No identified Pro asset package
or paid provider request was used.

Original analytics and widget bootstrapping is removed. No original service
project ID, verification secret, session token or Google tracking ID is embedded.
The selected source still contains documentation examples (including hashing
examples) and ordinary public product links; examples are not live credentials.
No external deployment, notification or live demo action was exercised.

Scope gaps preserved explicitly: remote website demo proxy (separate module),
live notification acceptance, custom help-domain
infrastructure, pricing/service availability and original missing feature views.
The native public routes, content and waitlist persistence do not need PHP.

Hero referrer mapping and message tables were extracted from the original
`App/Helpers/ReferrerAnalyzer.php` constants and rules, then implemented natively.
100 original-source input/output fixtures pass, plus message priority and script
injection checks. Waitlist tests against real local D1 pass CSRF, validation,
duplicate admission, configured email delivery and ambiguous no-replay using
provider fixtures only. No notification provider request was made.

Read-only site baseline was `94863c4557cad8bfc02817a6c5a06a54db0fb3f0`. The only
reported original worktree changes at final source inspection were untracked
`AGENTS.md` and `test-results/`; neither was ported. Retained template/assets came
from tracked source, with original asset hashes recorded separately. Current
compiled JS license files for Bootstrap, Headhesive and regenerator-runtime were
retained alongside their selected bundles. Final whole-source dirty digests are
owned by the root source-custody record.
