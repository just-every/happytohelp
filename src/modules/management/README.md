# Native product management

Hono routes over the edition's canonical D1 identity, conversation and media
records. The management module exports `routes` for `/api/management`,
`dashboardRoutes` for retained `/api/dashboard` contracts, `publicWidget` for
`/api/widget`, and `widgetEvents` for `/api/conversations`.

Project membership is rechecked on every request. `GET /bootstrap?projectId=` answers a
member with that project's workspace plus `sessionProjectId` (the project the session
is bound to, which the dashboard loader aligns with the URL through
`/api/identity/switch-project`) and `isPlatformAdmin`; a project the account does not
belong to and one that does not exist are refused identically with a 403 that says so;
a member whose role is below owner/admin is refused owner/admin actions with a 403 that
names the required role. Global inbox reads aggregate
only the current user's memberships. Platform administration additionally requires
an explicit `platform_admins` row; project ownership does not grant it. Widget
identity verification secrets are projected only in owner/admin widget settings, and
every project gets one at creation (migration `0106` backfills older projects).
`PUT /projects/:id/widget-settings` takes the widget settings object itself as the body
(`{theme, settings, text}`); the dashboard sends only the overrides a person edited and the
widget merges them over its own defaults (`src/modules/widget/js/context/defaults.js`).

Project settings, availability, per-audience default AI selection, AI profiles,
macros, plugins/order, contact details/blocking, memberships/invitations, primary
project preference, profile and administration use typed field allowlists. The
retained dashboard reads original bucket IDs, messages and private notes from
canonical storage and maps original status/assignment/cursor contracts. Widget
collector actions use the customer-context module; selected insight pairs use
conversation admission; generation and operator suggestions use AI support.

Pending invitations (`invitations.ts`, `invitation-store.ts`) are the unused invite links for one email in one
workspace, listed on `GET /projects/:projectId/agents` with `invitation_id` (the lower-cased email), `expires_at`
and a per-row `canManage` computed from the caller's role (owners: all; admins: invitations that grant the operator
role; operators: none). `POST .../invitations/:invitationId/link` issues another link (links are stored as hashes and
cannot be shown again), `POST .../resend` emails a fresh link and fails closed with 503 when no email provider is
configured, and `DELETE .../invitations/:invitationId` removes every unused link. Each re-reads the caller's membership of
the path's workspace and refuses what they may not manage. Using one link retires the others issued for the same email
(`identity/accounts.ts`). `tests/management-invitations.mjs` covers the routes and role refusals on real local D1.

Owners and admins can permanently erase a contact's personal data
(`contact-erasure.ts`, `contact-erasure/`): R2 objects are staged in
`contact_erasure_objects` and deleted first, then one D1 batch removes or redacts
the contact's identity, sessions, message content, attachments, customer context,
notes, AI assist options and output, imported bucket summaries, delegated-work
output, delivery addresses and legacy archive copies,
and records a non-identifying `contact_erasures` audit row. Message identity,
revision and frontier are kept (`messages.erased_at`); a client-supplied
`local_id` becomes `erased:<message id>`, a prefix admission reserves, while the
server-minted `email:<hash>` and `generation:<id>` ids later reads depend on stay
(a caller-chosen generation id must be a UUID, `ai-support/generation-id.ts`). Repeating an erasure is safe
and completes an interrupted one. `tests/contact-erasure.mjs` proves it on real
local D1/R2; docs/PRIVACY.md describes the operator-facing behaviour.
The same batch redacts `inbound_emails.evidence_json` (migration 0104) to the
classifier's `reasons` (`contact-erasure/inbound-evidence.ts`). Request counters
(`abuse_counters`) are not erased: they hold only counts under SHA-256 keys and
expire within a day.

Migrations 0070/0071 own management records; 0103 owns contact erasure. Related core and AI migrations remain
necessary: management is an integrated capability, not a replacement database.
`tests/management.mjs` uses real local D1/R2, covering tenant and admin boundaries,
secret projection, original inbox filters/bucket history, notes/participants,
contact collection, missing provider configuration and email ingress identity.
Browser behavior is verified by the dashboard/widget integration lane separately.
