# Local computer source capability

Native TypeScript port of HappyToHelp `app/Services/LocalAgents` and
`docs/local-agent-contract.md`; the edition preserves the actual Node connector
under `local-agent/` including Codex app-server, Claude CLI and existing-session MCP.
The Worker never runs a shell or desktop operation. A separately paired host does.
The connector tests use isolated temporary fixtures and provider boundaries.

Select this directory, migrations/030_local_computer.sql and local-agent as source.
Register `registerLocalComputerRoutes(app, integration)`. Integration explicitly
supplies operator authorization, current membership, a bounded scoped context, and
conditional reply delivery. `src/edition/local-computer.ts` binds those contracts to HappyToHelp's
native conversation admission. Consumers may supply another domain's adapters.

Pairing and grants store only secret hashes. Claims preserve run/claim identity;
capacity and queued-to-running transition are conditional SQL. Running jobs are
never requeued after host disappearance. Context access and results check live
membership and device ownership. Authority modes remain investigate, resolve and
resolve_reply. Presence and actual listening readiness are separate markers.

Result proposals are selected explicitly and receipt identity prevents repeated
sends or child creation. Presence of a replies key disables legacy automatic
reply delivery. Unverified resolve_reply requires input. Conversation frontier
checks apply at actual message admission. A failed/uncertain delivery receipt
requires review and is never silently replayed. Screenshots remain job/device
owned and are private project-scoped R2 artifacts.

The native module currently preserves connector protocols and principal lifecycle;
legacy presentation details need acceptance against the full original UI.
Completed reports write native internal notes and context includes recent notes. The current project authorization decision endpoint
is authenticated; the edition supplies the first-party browser form.

Verification: node tests/local-computer-runtime.mjs runs the real module HTTP routes against local workerd, D1 and R2. The native browser authorization page is supplied by WorkspacePages/ComputersPage; pairing/device secrets never enter its URL.

Result event, terminal status and pending effects commit atomically. Retry or scheduled recoverLocalResultEffects resumes notes and exact-ID reply admission after a crash. Tests inject a post-delivery/pre-note failure and prove one message plus one note after recovery.
