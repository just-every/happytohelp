# HappyToHelp experience

An operator starts with a customer's request and needs a verified outcome across
workspaces they control. The decisive moment is reviewing an agent's evidence,
understanding exactly what changed, and choosing the customer's next message.

Create a request → choose a connected workspace and agent → delegate a bounded
instruction with explicit authority → follow progress or answer a question →
review verified evidence → approve the reply and resolve.

`investigate` authorizes read-only work. `resolve` authorizes the named changes
and leaves replies as proposals. `resolve_reply` additionally authorizes the
edition's delivery path for the one verified reply. Scope and mode are recorded
with the delegation, not inferred from customer text or attachments. Revocation
and cancellation remain observable to a running agent. An interrupted action
with uncertain outcome requires reconciliation before repeating it.

The UI is backed by stored requests, connections, assignments and evidence. There
are no seeded production customers, fake agents or fallback successes. Design
images may contain illustrative content and are design artifacts only.

Source lineage: Relay's evidence review, explicit human gate, immutable decision
context, idempotency and reconciliation; the owner's HappyToHelp product and
Codex skill's connected-workspace, resumable claim and durable receipt semantics.
The edition does not claim Relay's entire historical contract as implemented.
