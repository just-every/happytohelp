# Owner publication and downstream handoff — v0.2.2

Publication belongs to the owner. Q-0-0010 excludes the public repository from
agent authority; OD-21 licence/public-release approval and the accessibility
HOLD remain outstanding. No WCAG conformance is claimed. T-022's timed live
recording remains missing. Local fixtures do not prove hosted/provider behavior.

Read `release.json` first. A failed local release gate blocks the commands below;
the owner must resolve the stated acceptance conflict and obtain a new passing
exact-source receipt before publication. The commands deliberately refuse a
receipt whose `localReleaseGate` is not `pass`.

## Fast-forward public main and tag (owner only, after approval)

Run in Bash on the owner's Mac. This makes an isolated public checkout, fetches
only the receipt's exact source commit from the private checkout, and refuses
any non-fast-forward public update. The later handoff-only commit is distinct
from the source SHA whose tests and artifact are recorded.

```bash
set -euo pipefail
export PATH=/Users/zemaj/www/rer-fleet/4-front-door/scratch/toolchain/node_modules/node/bin:/Users/zemaj/.npm-global/bin:/usr/local/homebrew/bin:$PATH
PRIVATE_SOURCE=/Users/zemaj/www/rer-consolidation/happytohelp
RECEIPT="$PRIVATE_SOURCE/verification/release-0.2.2/release.json"
export RECEIPT
VERIFIED_SHA=$(node --input-type=module -e '
  import fs from "node:fs";
  const r = JSON.parse(fs.readFileSync(process.env.RECEIPT, "utf8"));
  if (r.localReleaseGate !== "pass") throw new Error("Local release gate is blocked; resolve receipt first");
  if (!/^[a-f0-9]{40}$/.test(r.sourceSha) || r.version !== "0.2.2") throw new Error("Invalid release identity");
  process.stdout.write(r.sourceSha);
')
PUBLIC_ROOT=$(mktemp -d /tmp/happytohelp-public-022.XXXXXX)
git clone https://github.com/just-every/happytohelp.git "$PUBLIC_ROOT/source"
cd "$PUBLIC_ROOT/source"
git fetch "$PRIVATE_SOURCE" "$VERIFIED_SHA"
git switch main
git merge-base --is-ancestor 59c6e2e1beb321e9f1cb5493efd05e20fc068638 "$VERIFIED_SHA"
git merge --ff-only "$VERIFIED_SHA"
test "$(git rev-parse HEAD)" = "$VERIFIED_SHA"
test -z "$(git status --porcelain)"
git push origin HEAD:refs/heads/main
# Never replace an existing tag. This fails if v0.2.2 already exists locally.
git tag -a v0.2.2 "$VERIFIED_SHA" -m 'HappyToHelp v0.2.2'
git push origin refs/tags/v0.2.2
REMOTE_TAG=$(git ls-remote --tags origin 'refs/tags/v0.2.2^{}' | cut -f1)
test "$REMOTE_TAG" = "$VERIFIED_SHA"
git ls-remote --tags origin 'refs/tags/v0.2.2' 'refs/tags/v0.2.2^{}'
```

If any check fails, stop; do not force, move a tag, or publish a release to bypass
it. A public main advance requires a new integration/verification decision.
These commands publish no GitHub Release object and deploy no Worker.

## Optional hosted CI verification (owner only)

GitHub workflow dispatch accepts a branch or tag ref. The peeled-tag equality
above binds this dispatch to the receipt's exact source SHA. Hosted CI is a
separate result, not the local receipt or a deployment.

```bash
# Continue in the public checkout, after the tag equality check above.
test "$(git ls-remote --tags origin 'refs/tags/v0.2.2^{}' | cut -f1)" = "$VERIFIED_SHA"
gh workflow run verify.yml --repo just-every/happytohelp --ref v0.2.2
gh run list --repo just-every/happytohelp --workflow verify.yml \
  --event workflow_dispatch --commit "$VERIFIED_SHA" --limit 5 \
  --json databaseId,headSha,status,conclusion,url
# Select the matching run ID from that output:
# gh run watch <matching-run-id> --repo just-every/happytohelp --exit-status
```

## Service / site / stage / production lanes after the tag

The bundle handoff is `release.json`: source SHA, version, artifact SHA-256,
migration inventory, database counts, upgrade row comparison and test outcomes.
The artifact remains outside git; its retained local path is in the receipt.
Transfer it through the lanes' approved artifact channel and verify SHA-256
before consuming it. Do not substitute a rebuilt artifact without a new digest.

1. Service lane: adopt the tagged HappyToHelp source/artifact in
   `src/projects/integrations/happytohelp/**`, validate the delivery contract and
   bump the service's `wrangler.jsonc` pin. These paths belong to the service
   repository, not this checkout. Preserve tenant/permission/admission fences;
   unknown paid or remote outcomes must not be replayed (Q-0-0007).
2. Stage lane: retain the existing source/version, migrations and consistent
   D1/R2 backup; apply the candidate to stage and produce an exact before/after
   upgrade receipt with row-level comparisons, object hashes, new migration
   identities, health, owner login, widget, Knowledge and cited-answer checks.
   The local v0.2.1 proof does not replace this stage receipt. Record the intended
   secret/context migration transformations explicitly.
3. Installation lane: complete the outstanding v0.2.0 install/upgrade records
   separately. No v0.2.0 evidence is inferred from a v0.2.1 database (Q-3-0001).
4. Production lane: after the accepted stage receipt and owner approval, perform
   the production one-click adoption; record baseline, desired and resulting
   version/artifact digest, migration/backup identity, live traffic and behavior,
   recovery plan and unresolved provider outcomes (T-018). No production or
   paid-provider acceptance is asserted by this repository's local checks.
5. Site lane: bump `data/releases/registry.json` to the public v0.2.2 tag/exact
   source and accepted artifact; update the site pin after the public tag exists.
   Validate the public links and published version. `seeds/happytohelp-native`
   is a separate lane and is not part of this release checkout.

The outstanding approvals and acceptance conflicts are listed in `release.json`.
Preparing this handoff authorizes none of these downstream effects.
