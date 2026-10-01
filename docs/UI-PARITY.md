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
| Not-found pages | Added after the 15 September comparison (1 October 2026). The original Laravel application was not re-run for this row, so it is not a parity claim. Unknown application paths show a branded 404 in the homepage visual language (title, message, links to the homepage and workspace); Help Center 404s (unknown project, missing article, unpublished draft) show inside the Help Center header with HTTP 404. Both return HTTP 404. |

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

| Remaining legacy gap | Reason and user impact | Supported alternative |
| --- | --- | --- |
| Global Contacts aggregation | Contact reads are project-scoped; there is no combined account-wide list. | Switch workspaces to review each workspace's Contacts. |
| Global Inbox Appearance settings | Color and display mode are saved per project. There is no persisted global inbox theme override, so one change cannot style every project. | Use each project's Appearance controls. |
| Standalone computer-consent metadata | The project settings contract has no matching standalone consent field, so that legacy metadata cannot be edited. Contact-specific customer-context consent is a different contract. | None for the standalone metadata. |
| AI type catalogue | The wider legacy catalogue is not exposed by the native API; those pre-defined types cannot be selected. | Define assistants by name, role, model and prompt; choose defaults for signed-in/other visitors and allow human responders. |
| Invitation-time notification preferences | Invitation records hold project, email, role and expiry, without notification preferences. The preference cannot be chosen when inviting. | After acceptance, edit the member's notification preference. |
| Some contact history | Contact profiles show available facts and transcripts include messages, notes and selected attributed events; there is no complete legacy contact-wide timeline. | Open available conversations for their supported history; no equivalent for missing historical event types. |
| Per-import credential entry | Imports use installation-configured credentials; the import form cannot retain credentials per job. | Configure the chosen source's credentials for the installation, then select the source and required subdomain in the import form. |
| Administrative aggregates/actions | Admin lists read raw records (up to 200), without several legacy aggregates/actions. Missing aggregate values display as em dashes and unsupported actions are absent. | Lead processing, sending a reviewed draft and deletion are supported. None for other missing aggregates/actions. |
| Original onboarding and demo flows | The original onboarding journey is not reproduced. Native owner setup and the existing demo inbox provide a different entry path. | In an empty workspace choose **Try a demo inbox** to create **Demo inbox · Northstar Outfitters**, with fictional conversations, an editable assistant and three published FAQs. Creation makes no AI, email or provider calls. **Generate replies** is a separate configured-provider action and never sends a customer reply. |
| Configured provider journeys | Local accessibility checks make no live provider calls, so delivery, OAuth acceptance and hosted behavior are unqualified. | Qualify the native integrations separately with configured accounts; local boundary fixtures are no substitute for provider acceptance. |

The accessibility audit and its exact route/state limits are recorded in
[ACCESSIBILITY-AUDIT-2026-09-30.md](ACCESSIBILITY-AUDIT-2026-09-30.md). It qualifies
keyboard and visual accessibility for the audited native states; it does not close
the feature/API gaps above.

The comparison screenshots are not part of this repository. The browser suites
named above (`pnpm run test:ui-browser` and related `test:*-browser` scripts)
are the maintained checks.
