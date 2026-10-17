# Audit

The workspace security log.

- `record.ts`: `auditStatement` returns one append-only row to batch with the change
  it records: category, action, outcome, actor (user, system, installation or API
  token), source door, target, purpose and a detail object of counts, reasons and
  ids (never secrets, message text or customer addresses).
- `read.ts`: one ordered page of `audit_events` plus the records older modules keep
  (`native_integration_audit`, pre-log `contact_erasures`); names are read at display
  time, so a removed account shows as a former teammate.
- `retention.ts`: the daily purge (from the cron in `src/server.ts`). It opens a
  purge window in `audit_purges` for one workspace and cutoff inside the same batch
  as the delete; `migrations/180_account_security.sql` refuses every other update
  or delete, and any delete a legal hold covers.
- `routes.ts`: Settings → Security log (owners and admins), CSV/JSON export behind a
  step-up, retention and legal holds (owners).

Tests: `tests/journeys/identity.mjs`, `tests/journeys/erasure.mjs`,
`tests/journeys/identity-browser.mjs`.
