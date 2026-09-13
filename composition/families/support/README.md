# Support foundation

Headless source selected by Lily, Beacon, Brook and HappyToHelp. The installer
copies selected files to the edition's `src/family/support/`; owners can edit those copies.
There is no runtime package registry, plugin discovery, shared database schema,
or ticket/conversation lifecycle.

`delivery.ts` separates provider acceptance, delay, delivery, and final failure
facts. Facts do not decide whether a ticket's response clock stops or whether a
conversation closes. In particular, Lily intentionally excludes suppression from
its narrower response-clock restoration predicate. Brook uses these facts for
signed mail events. HappyToHelp selects only delivery facts for reply review;
it does not acquire support-intake or support-email code.

The optional `support-intake` module owns authenticated incoming-message identity
and replay semantics for Lily, Beacon and Brook, with its own source, tests and
guide under `src/modules/support-intake/`, `tests/composition/support-intake/`
and `composition/modules/support-intake/README.md` in exported editions.

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
