# Delivery packaging

`build.mjs` calls the Base delivery producer at the current selected origin
`995225ee695bb57b3cfbf8dbf293ee48070dcbe9`. The previously documented origin
`6047b4cf5c2312f834f113497974dd5947db69cb` is historical. All 19 portable files
are unchanged from the preceding `0d6a92fbdcb65c5f63033d15f28222fa47e5ed3e` export.
`base/packaging.json` is HappyToHelp policy; Base runtime files in `base/` are
maintained upstream. Use the official exporter when a selected producer change
requires an update.

The producer accepts a canonical GitHub HTTPS source URL and retains a GitHub
owner and repository pair as legacy packaging input. HappyToHelp uses `just-every/run-happytohelp`; the public
`rer-project.json` descriptor records the corresponding HTTPS destination
`https://github.com/just-every/run-happytohelp`. Publication identity checks exercise
the actual generator and compare these two representations of the same source.

`pnpm run build` packages the emitted tree automatically, cleaning its generated
`delivery-artifact/` output first. For an existing emitted tree with no artifact,
run `node scripts/delivery/build.mjs`; direct calls require a fresh empty output. Upload the whole directory: the
schema-2 manifest references raw `payload/` files with SHA-256 and byte sizes.
Packaging neither deploys nor authorizes provider effects. D1/R2 recovery does
not cover Durable Object storage. `tests/journeys/installer.mjs` compares the same
emitted candidate with the test-only pre-adoption oracle; the only expected MIME
changes are the two font LICENSE.txt files, now text/plain.

The export contains 12 root runtime files, four generators and three setup-schema
files. The upstream exporter changes only the setup-validator import and schema
URL in `base/setup-manifest.mjs` to their exported locations. This generated
projection is tracked in the source origin mapping and excluded from the record
of verbatim copies. Packaging policy remains edition-owned.
