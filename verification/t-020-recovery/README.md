# Native recovery comparison

This additive suite leaves `tests/independent-runtime.mjs`, its 97-table
assertion, and all pre-existing tests/helpers unchanged. It qualifies two
separate emitted artifacts: the historical launch source `09d80a7` has 104
tables and 38 applied migrations; the converged candidate retains migration
`0106_project_verification_secret.sql` and has 104 tables and 39 migrations.
The historical result must never be presented as a current-candidate result.

The comparison creates a native owner, visitor conversation, published article
and authenticated media upload. After stopping the Worker it snapshots every
D1 table row and schema definition, and every R2 object (including HTTP/custom
metadata, a zero-byte object, and multiple listing pages). Wrangler performs an
actual local D1 export and imports it into a fresh native D1 database. R2 starts
empty and is separately restored. The suite compares every row and object,
requires byte-identical SQL re-export, then starts the restored Worker and
checks retained-session access and a fresh password login, media bytes,
transcript, unauthenticated-media denial and setup refusal.

Run with the declared Node and pnpm versions after a frozen install. From each
clean source checkout, build an artifact with the *new* helper (an absolute
path permits using the same helper against the historical checkout):

```sh
node /path/to/candidate/tests/recovery-artifact-build.mjs /absolute/new/build-directory
```

From the candidate checkout containing this suite and its dependencies:

```sh
node --test tests/recovery-snapshot.mjs
H2H_RECOVERY_PORT=18260 node tests/recovery-comparison.mjs launch /absolute/launch-build /absolute/new/launch-proof
H2H_RECOVERY_PORT=18260 node tests/recovery-comparison.mjs candidate /absolute/candidate-build /absolute/new/candidate-proof
```

Each output directory must be new. Build receipts pin source, artifact, lockfile,
migration and build-log hashes; recovery receipts pin export hashes and
per-table/per-object comparisons. Raw runtime data contains generated test
fixtures only. Native runtime directories are removed in `finally` after logs
are copied; no server is intentionally left running. Do not publish build
artifacts or interpret a receipt as approval to publish the product.

This is a local D1/R2 recovery proof. It does not export Durable Object storage,
queue state, or establish a complete RER export, hosted/production recovery,
live-provider behavior, or accessibility conformance. The separate accessibility
checker remains held; this suite changes no checker or prior evidence.

The parent integrator may add `test:recovery-comparison` pointing to
`node tests/recovery-comparison.mjs`; the explicit profile and immutable build
receipt arguments remain mandatory. The original independent-runtime package
script and assertions must remain unchanged.
