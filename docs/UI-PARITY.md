# Original UI restoration and known differences

On 15 September 2026 the native dashboard was compared screen by screen with a
running instance of the original Laravel application, using separate disposable
local databases, and the original HappyToHelp presentation was restored. This
page records what was restored and which original features are still missing.

## Restored surfaces

| Surface | Changes |
| --- | --- |
| Workspace and inbox | Original purple navigation, workspace switcher, icons, active states, unread count, account menu and mobile header. Extra native settings remain accessible. |
| Project | General, Appearance, Availability and GitHub tabs; original columns, timezone selector, brand controls, persisted color/mode and real schedule settings. |
| Account and access | Profile tabs and avatar layout; original centered login, registration and recovery frame; tokenless setup retained for loopback development only. |
| Projects and owner controls | Project table and header action; owner settings and project controls retained. Earlier billing/payment layout observations are historical comparison evidence only. |
| AI and management | Dedicated assistant/default-responder controls, saved reply and plugin forms, agent list and pending invitations, contact details. |
| Knowledge | Dataset forms and source tabs, article editor/import selection, category tree, original help-center empty state, real editing/deletion and evaluation access. |
| Insights and administration | Original list/empty-state presentation, dedicated admin navigation, resource-specific columns and labelled record details. |
| Widget | Existing original React controls retained and checked across Code, Theme, Settings and Texts. |

Pages own their controls through `PageHeaderActions` and `PageHeaderTabs`; the
common frame places these beside or below the title. Dashboard styles, icons and
palette are editable first-party source; they replaced the earlier theme-based
styles with visual parity, and the one visible change is that the attachment row
now shows its paperclip icon. A screenshot conversion is comparison evidence,
not a replacement for dynamic workspace names, user data or original vector assets.

## Verification and limits

The page sweep covered 35 routes and 11 tab states at desktop and mobile sizes
(92 captures). It found a mobile profile file-input overflow; a focused closeout
checks the fix and the public account pages. Original screenshots and failed
probes are retained alongside native captures. Fixture data differs between the
two runtimes; populated states and remote-provider results are not implied by an
empty-page screenshot.

The native browser suite verifies durable replies, notes, saved replies, project
settings, brand upload, plugin edits, invitations, AI defaults/switches, categories
and mobile navigation. Two additional real-Worker checks verify editing an
existing article's categories and clearing an existing category's parent. The
review also corrected an unset human-response preference being saved as disabled.
Setup and widget browser suites, module tests and emitted Worker checks remain
part of acceptance. See `HANDOVER.md` for commands.

This is a substantial consistency pass, not full legacy feature equality. Each
remaining gap has an explicit product/API disposition; this accessibility closeout
does not invent unsupported data or controls to make the screens appear complete.

| Remaining legacy gap | Current disposition and reason |
| --- | --- |
| Global Contacts aggregation | Native Contacts offers explicit workspace choices. The cross-workspace aggregate is not backed by a native API and is not presented as if it were available. |
| Global Inbox Appearance settings | Appearance is project-scoped in the native settings model. A global override has no matching persisted contract, so the native UI keeps the supported per-project controls. |
| Standalone computer-consent metadata | The native project schema does not expose the legacy standalone consent fields. No editable control is shown without a persisted API contract. |
| AI type catalogue | Native assistant controls cover the configured responder types exposed by the current API. The wider legacy type catalogue is not in that API and is not implied by these controls. |
| Invitation-time notification preferences | The native invitation/member contract does not persist the original per-invite notification options. They remain a feature gap rather than a local-only setting. |
| Some contact history | The native contact API does not return all legacy history records. Existing history is shown only where the native API supplies it. |
| Per-import credential entry | The native import flow has no per-import credential storage/entry contract. The interface does not simulate credential retention. |
| Administrative aggregates/actions | Several legacy aggregate values and admin actions lack native API support. Unsupported aggregates remain an em dash; unavailable actions are not exposed as working. |
| Original onboarding and demo flows | The local acceptance path uses native setup and synthetic records. The original legacy demo/onboarding journeys are not asserted as equivalent. |
| Configured provider journeys | This local pass makes no live provider calls and does not establish external credentials, delivery, or provider acceptance. Those journeys remain separate qualification work. |

The accessibility audit and its exact route/state limits are recorded in
[ACCESSIBILITY-AUDIT-2026-09-30.md](ACCESSIBILITY-AUDIT-2026-09-30.md). It qualifies
keyboard and visual accessibility for the audited native states; it does not close
the feature/API gaps above.

The comparison screenshots are not part of this repository. The browser suites
named above (`pnpm run test:ui-browser` and related `test:*-browser` scripts)
are the maintained checks.
