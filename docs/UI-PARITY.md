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

This is a substantial consistency pass, not full legacy feature equality. Native
APIs still lack the original global Contacts aggregation and global Inbox
Appearance settings, standalone computer-consent metadata, the AI type catalogue,
invitation-time notification preferences, some contact history, per-import
credential entry, and several administrative aggregates/actions. Global Contacts
now offers explicit workspace choices. Unsupported fields/actions are not shown
as working; unavailable aggregates use an em dash. Original onboarding/demo flows
and configured provider journeys have not been established by this pass.

The comparison screenshots are not part of this repository. The browser suites
named above (`pnpm run test:ui-browser` and related `test:*-browser` scripts)
are the maintained checks.
