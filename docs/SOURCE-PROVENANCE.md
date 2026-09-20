# Source origins and redistribution boundary

The migration baseline was captured on 2026-09-14 from active first-party source.
The original checkouts were read-only. This edition contains retained and ported
source, not a wrapper around a required PHP, Lambda, MySQL or Python application.
Original source changes after the observation do not silently update this edition.

| Origin | Observed committed revision | Current role |
| --- | --- | --- |
| Run Edit Run Base | `d840a75b4c41ddc1feae99695d6632c8b0a451d2` | Foundation/runtime lineage and retained authoring tool; Base MIT notice in docs/licenses |
| HappyToHelp main | `7c733f7b4204c7af7b5422953dea1be67d4fca78` | React dashboard, local Node connector and PHP behavior ported to native services |
| HappyToHelp Chat | `bce98c897ec5743dcf243311b6c1886b1057f5e3` | Assistance, replies, monitoring, profiles, evaluation and model orchestration; active working changes were part of migration review |
| HappyToHelp Widget | `69f6152963d0c89d6495d1adbedb73eab9ce1d62` | React/Shadow DOM UI retained with native transport |
| HappyToHelp Site | `94863c4557cad8bfc02817a6c5a06a54db0fb3f0` | Public content and assets; see PUBLIC-SOURCE-PROVENANCE.md |
| HappyToHelp Completions | `692aff289c1ad65b3ac35180da523494866eea25` | Ingestion/retrieval behavior ported; no Python service retained |
| HappyToHelp Plugin SDK | `c41f761c11ee7b45b1cf48e9a0bb0bd2e48fd2e0` | Reusable host/plugin messaging source |

These commits identify origins, not exact identity of every effective file. The
Chat baseline included active changes to connection, message/reply admission,
transport and their regression tests; the final edition source lock, after freeze,
identifies the actual selected bytes. Frozen evaluation comparator files are
historical test inputs; their explicit native context adapter does not claim the
historical database runtime is unchanged.

The public source boundary is the edition root `LICENSE` plus the notices under
`docs/licenses/`. The root notice covers first-party Run Edit Run source. The
owner-approved/generated homepage and installer art and the owner-supplied
HappyToHelp branding are recorded in the edition asset manifests and are not
relicensed as MIT code. Claude and Codex marks are nominative references to
supported tools, not Run Edit Run property or vendor endorsement. Third-party
notices identify retained Base, Ensemble, Inter, Lucide, the active
Feather-derived WOFF and Font Awesome Free material.

The retained Ensemble source has its own LICENSE, SOURCE.json and SOURCE.patch
under ai-support/vendor/ensemble. Preserve them together. Preserve all package
licences and notices from the frozen dependency graph; installation/download
verification is separate from legal redistribution review. The ported H2H Site
CSS/patterns and dashboard icon/masks retain source attribution in
`docs/PUBLIC-SOURCE-PROVENANCE.md`; no unidentified retained local asset path
remains in the current asset audit. The unused Feather fallback files and
historical Font Awesome Pro assets are not release inputs. External Google Fonts
imports remain runtime dependencies rather than bundled assets.

Do not include .env files, device credentials, local browser profiles, production
customer data, private provider outputs or runtime state in a source release.
The connector packaging script uses the existing allowlist (package metadata,
README, bin/lib and optional skills), excluding those local artifacts. Synthetic
fixtures are explicitly marked and remain test/evaluation inputs. No seeded fixture
is a paid-provider result or a real customer record.
