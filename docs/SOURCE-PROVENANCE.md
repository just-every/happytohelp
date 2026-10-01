# Source origins and licensing

HappyToHelp 0.2.0 is a native port of the original HappyToHelp service. The
original repositories were read, not modified, when the port began on
14 September 2026. This repository contains the retained and ported source; it
does not wrap or require any original PHP, Lambda, MySQL or Python service, and
later changes to the originals do not flow into it.

| Origin | Observed revision | Role in this repository |
| --- | --- | --- |
| Run Edit Run Base | `d840a75b4c41ddc1feae99695d6632c8b0a451d2` | Runtime foundation and retained authoring tool (see `edition.json` for the exact per-component revisions) |
| HappyToHelp main | `7c733f7b4204c7af7b5422953dea1be67d4fca78` | React dashboard and local Node connector; PHP behavior ported to native services |
| HappyToHelp Chat | `bce98c897ec5743dcf243311b6c1886b1057f5e3` | Assistance, replies, monitoring, profiles, evaluation and model orchestration |
| HappyToHelp Widget | `69f6152963d0c89d6495d1adbedb73eab9ce1d62` | React/Shadow DOM widget, now on native transport |
| HappyToHelp Site | `94863c4557cad8bfc02817a6c5a06a54db0fb3f0` | Help Center content model; see [PUBLIC-SOURCE-PROVENANCE.md](PUBLIC-SOURCE-PROVENANCE.md) |
| HappyToHelp Completions | `692aff289c1ad65b3ac35180da523494866eea25` | Ingestion and retrieval behavior, ported; no Python service retained |
| HappyToHelp Plugin SDK | `c41f761c11ee7b45b1cf48e9a0bb0bd2e48fd2e0` | Reusable host/plugin messaging source |

These revisions identify where source came from, not the exact bytes of every
current file; the source lock (`sources.lock.json`) records the current files.
The Run Edit Run Base origin repository named in `edition.json` and
`.edition/sources` is not public; the committed `.edition/sources` snapshots are
the authoritative copies, so `pnpm run source:check` works offline without it.
Frozen evaluation comparator files are historical test inputs.

## Licensing

The whole repository is MIT licensed; see the root [`LICENSE`](../LICENSE). That
includes the homepage drawings, the setup artwork, the HappyToHelp mark and the dashboard
styles, all of which are first-party. The Claude and Codex names, and their logo
glyphs in `src/ui/dashboard/components/LocalAgentGlyph.jsx` (from Lobe Icons, MIT),
identify supported local tools; no endorsement is implied.

Third-party material keeps its own notice:

- Run Edit Run Base: [`docs/licenses/base-MIT.txt`](licenses/base-MIT.txt).
- Lobe Icons (Claude and Codex logo glyphs): [`docs/licenses/LOBE-ICONS.md`](licenses/LOBE-ICONS.md).
- favcount 1.5.0: MIT notice inline in `src/ui/dashboard/favcount.jsx`.
- Ensemble: `src/modules/ai-support/vendor/ensemble/LICENSE`, with `SOURCE.json`
  and `SOURCE.patch`. Keep the three together. `SOURCE.json` also lists the
  edition-owned overrides (`utils/json_schema.js` preserves `minItems`/`maxItems`
  for grounded `evidence_ids`; `utils/tool_parameter_utils.js` passes explicit
  nulls through required nullable tool parameters; `model_providers/openrouter.js`
  attributes requests to this open-source project), which are not part of the
  recorded upstream patch.
- Outfit, Inter, Feather icons, Lucide reply icons and Font Awesome Free: see
  [PUBLIC-SOURCE-PROVENANCE.md](PUBLIC-SOURCE-PROVENANCE.md#third-party-components).
  The dashboard's earlier third-party admin theme (its styles, template entry
  files and avatar masks) and its Feather webfont were removed and replaced by
  first-party styles; `src/ui/dashboard/asset-provenance.json` records each
  removed file's hash and the reason.
- npm dependencies: each package's own licence, as locked in `pnpm-lock.yaml`.

## What a source release must never contain

Do not include `.env`/`.dev.vars` files, `.seed/` installer state, device
credentials, local browser profiles, production customer data, private provider
outputs or runtime state. The local agent packaging script uses an explicit
allowlist (package metadata, README, `bin`, `lib` and optional skills). Test
fixtures are synthetic and marked as such; none is a real customer record or a
paid-provider result.
