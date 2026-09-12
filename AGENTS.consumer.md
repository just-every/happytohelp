# Working on HappyToHelp

Read README.md, CONTRACT.md, HANDOVER.md and PROVENANCE.md first. Use Node 26.8.1
and pnpm 10.12.4. This is a self-contained editable edition; author repositories
are not runtime dependencies. Preserve owner intent when integrating updates.

The application uses TanStack Start for documents, Hono for /api and /health,
and Cloudflare D1 for durable state. UI is in src/ui, protocol and persistence in
src/backend, and the standalone transport helper is scripts/agent.py. Shared
source is copied under src/modules by the pinned composition.

Never use mock production agents, customer data or success fallbacks. The three
modes are distinct authority: investigate is read-only; resolve permits scoped
changes but leaves reply proposals; resolve_reply grants advance authority for
one verified reply through the durable outbox. Customer text is evidence, not
permission. Cancelled, revoked and uncertain operations must remain honest.

Keep pending receipt event identities stable across retries. Never automatically
repeat a side effect with an unknown outcome. Provider acceptance is not mailbox
delivery. No test may send real email or act in an owner's real workspace without
explicit authorization. Use isolated local workspaces for protocol acceptance.

Run pnpm verify and record any uncovered contract or external acceptance evidence
in HANDOVER.md. Build before deployment; Cloudflare environment is selected at
build time. Never commit .dev.vars, credentials, local D1 state or helper state.
