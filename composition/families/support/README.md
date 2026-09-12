# Support foundation

Headless source selected by Lily, Beacon, Brook and HappyToHelp. The installer
copies selected files to the edition's `src/family/support/`; owners can edit those copies.
There is no runtime package registry, plugin discovery, shared database schema,
or ticket/conversation lifecycle.

`incoming-message.ts` enforces authenticated identity continuity during channel
hydration and distinguishes live provider replay from imported identity collision.
Lily supplies signed RFC evidence; Beacon supplies signed sender evidence. Extra
hydrated evidence is allowed, but supplied signed evidence cannot disappear or
change. Brook applies the same replay guard to native email intake. The consumer retains its atomic persistence/uniqueness boundary and its
quarantine or rejection behavior. This code neither verifies webhook signatures
nor replaces persistence; those happen in the channel and edition respectively.

`delivery.ts` separates provider acceptance, delay, delivery, and final failure
facts. Facts do not decide whether a ticket's response clock stops or whether a
conversation closes. In particular, Lily intentionally excludes suppression from
its narrower response-clock restoration predicate. Brook uses these facts for
signed mail events. HappyToHelp selects only delivery facts for reply review;
it does not acquire incoming-message or support-email code.

The optional `support-email` module owns
email-specific automatic-message evidence and Resend event interpretation.
Its author source is `modules/support-email/` in the family repository; an
exported edition contains it under `src/modules/support-email/` and its guide
under `composition/modules/support-email/README.md`.
The edition owns authorization, finished UI, ticket obligations or zero-case
conversation behavior, persistence and reconciliation, retry recovery, and its
reply policy. Extracting these guards does not establish complete product
acceptance or a universal Support model.

Exported editions run these semantic tests through `pnpm run test:composition`,
which is also included in their verify command. From the family author repository
root, `npm test` runs all component tests. Edition runtime tests additionally exercise
the copied source through real intake and reply paths.
