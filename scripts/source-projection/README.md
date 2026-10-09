# Public comparison archives

The four retained baselines are deterministic public projections. Each projection
has a new origin, key, member digest and full-artifact SHA-256. Its `original`
record binds the byte-exact private archive, original key/member digest, Git
revision and a digest of its original origin. The Git revision is historical
provenance, never a claim that the public projection was that Git tree.
`originals.json` pins private custody; `projections.json` records every mapping
and every changed member. No original is required for ordinary public checks.

Policy `h2h-source-public-v1` retains all 63 members and executable bits. Four
foundation-donor members change: the README's illustrative repository URL uses
an example domain, and the three archived authoring tests use synthetic Git
author emails at example.test. All other member bytes remain exact. All four
original origin envelopes become the explicit projection envelope. There are
no PNG/image members, dropped images, or genuine private-parent assertions in
these four inputs. Retained test passwords/tokens are manufactured word-based
fixtures; their assertion inputs stay unchanged and their exact artifact review
uses reason `synthetic test value, never a credential`.

Public checks:

```sh
node --test --test-concurrency=1 scripts/source-projection/*.test.mjs
node scripts/edition-authoring/cli.mjs check
```

The normal module verifier includes these tests. The comparison test calls the
real snapshot, extraction and compare implementations for all three selected
components and the entire parent. It checks every extracted member/mode, no
upstream change for the selected baseline, visible real byte/mode edits, and
the onboarding component's explicitly unmapped `null` local comparison.

The comparer regards only an exact recorded original/projected member digest
pair at its exact path as equivalent. This expresses the authorized sanitation;
it does not hide another edit on that path or ignore executable changes. Raw
byte provenance and the transformation receipt remain separately visible. The
whole-parent comparison includes every retained and current member. Origins,
incoming Git identities and full archive digests naturally differ and are not
behavioral comparison output.

Private reproducibility and equivalence are a separate mandatory release proof.
Supply the private directory explicitly; it must contain exactly the four regular
files named by `originals.json`, at their byte-exact full hashes, with no other
directory entries:

```sh
node scripts/source-projection/equivalence.mjs "$ORIGINAL_ARCHIVE_DIRECTORY"
```

This fails on missing or extra archives, malformed names, unexpected filesystem
entries, archives under another pin's filename, altered or symlinked originals,
including dangling links and links in directory components. The private proof
also exercises the real single-file and
batch generators with authentic pinned regular inputs and disposable copies for
each rejected case. Rejected inputs create no projection or retained-output
changes. Both generators reproduce the same bytes on repeated runs under
different locale/timezone settings and absolute/relative input paths.
It reproduces each public archive
byte for byte, compares every original/projected member and mode, runs the same
production extraction and comparison functions against both with the same
current effective source and incoming candidate, and requires identical semantic
reports. It repeats a real byte/mode mutation to prove substantive differences
remain visible. It also executes every `.test.mjs` in each original and projected
archive and compares all test outcomes; no test is skipped or replaced.
Temporary Git repositories/extractions are removed on success and failure.

For deterministic regeneration in a disposable candidate checkout:

```sh
node scripts/source-projection/retain.mjs "$ORIGINAL_ARCHIVE_DIRECTORY"
git add edition.json .edition/sources scripts/source-projection/projections.json
node scripts/edition-authoring/cli.mjs lock
```

`retain.mjs` checks the exact input directory inventory, rejects linked input
paths and authenticates every input before writing projections, changing recipe
or mapping files, or removing the old tracked original paths. The source
lock selects only the new projections. A missing, corrupt or
selection-mismatched projection fails offline instead of fetching a private
source. Never distribute the original directory, put its path into public
source, or publish private history. Full product verification remains a
separate gate; these checks do not establish runtime, hosted or provider results.
