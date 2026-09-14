# Native product management

Hono routes over the edition's canonical D1 identity, conversation and media
records. The management module exports `routes` for `/api/management`,
`dashboardRoutes` for retained `/api/dashboard` contracts, `publicWidget` for
`/api/widget`, and `widgetEvents` for `/api/conversations`.

Project membership is rechecked on every request. Global inbox reads aggregate
only the current user's memberships. Platform administration additionally requires
an explicit `platform_admins` row; project ownership does not grant it. Widget
identity verification secrets are projected only in owner/admin widget settings.

Project settings, availability, per-audience default AI selection, AI profiles,
macros, plugins/order, contact details/blocking, memberships/invitations, primary
project preference, profile and administration use typed field allowlists. The
retained dashboard reads original bucket IDs, messages and private notes from
canonical storage and maps original status/assignment/cursor contracts. Widget
collector actions use the customer-context module; selected insight pairs use
conversation admission; generation and operator suggestions use AI support.

Migrations 0070/0071 own management records. Related core and AI migrations remain
necessary: management is an integrated capability, not a replacement database.
`tests/management.mjs` uses real local D1/R2, covering tenant and admin boundaries,
secret projection, original inbox filters/bucket history, notes/participants,
contact collection, missing provider configuration and email ingress identity.
Browser behavior is verified by the dashboard/widget integration lane separately.
