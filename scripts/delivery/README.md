# Delivery packaging

`build.mjs` calls the unchanged Base delivery producer exported from
the modules/delivery-producer directory at `d6a1bd83ee80ec3d603ded2c067d4c504d8a2bf5`.
`base/packaging.json` is HappyToHelp policy; Base runtime files in `base/` are
maintained upstream. Re-export from that pinned source to update them.

The pinned producer requires `project.sourceRepository` as a GitHub owner and
repository pair in its packaging input. HappyToHelp uses `just-every/happytohelp`; the public
`rer-project.json` descriptor records the corresponding HTTPS destination
`https://github.com/just-every/happytohelp`. Publication identity checks exercise
the actual generator and compare these two representations of the same source.

`pnpm run build` packages the emitted tree automatically, cleaning its generated
`delivery-artifact/` output first. For an existing emitted tree with no artifact,
run `node scripts/delivery/build.mjs`; direct calls require a fresh empty output. Upload the whole directory: the
schema-2 manifest references raw `payload/` files with SHA-256 and byte sizes.
Packaging neither deploys nor authorizes provider effects. D1/R2 recovery does
not cover Durable Object storage. `tests/delivery-base.mjs` compares the same
emitted candidate with the test-only pre-adoption oracle; the only expected MIME
changes are the two font LICENSE.txt files, now text/plain.
