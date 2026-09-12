# HappyToHelp product contract

The installable edition is an operator-controlled delegation desk for one owner.
This is its minimal product scope, not incumbent parity or Relay's full contract.
A passing build does not prove external workspace effects or mailbox delivery.

- **H2H-AUTH-001** First owner creation requires a deployment bootstrap secret;
  subsequent login checks a stored password hash and creates an expiring opaque
  cookie. Browser mutations require the deployment origin.
- **H2H-SCOPE-001** An owner creates workspaces and credentials scoped to selected
  workspaces. Revocation prevents further claims and updates. The connection
  grants no filesystem access by itself: the attached agent must actually have
  access to the owner-selected workspace.
- **H2H-REQUEST-001** Operator-created requests and their customer context persist
  in D1. Empty installations show honest empty states.
- **H2H-AUTHORITY-001** Every delegation records the operator instruction, selected
  workspace and explicit investigate, resolve or resolve_reply authority.
  Customer messages and attachment contents are evidence, not scope authority.
- **H2H-CLAIM-001** Concurrent claims cannot execute the same live assignment with
  two run identities. A resumed claim exposes the same durable context, and an
  uncertain prior action must be reconciled before it is repeated.
- **H2H-CONTROL-001** Agents can read cancellation and operator input before an
  action and before result submission; revoked or cancelled jobs reject further
  changes. An operator can answer a focused question without creating a new job.
- **H2H-EVIDENCE-001** A completed result requires verification and records actual
  actions separately from proposed replies and follow-up work. Event identity
  deduplicates submissions; a reused identity with changed content is rejected.
- **H2H-REVIEW-001** Operators review the stored evidence before resolving.
  investigate and resolve never authorize automatic customer outreach.
  resolve_reply is explicit prior authorization for one verified reply through
  the edition's delivery path; provider acceptance and customer delivery remain
  distinct recorded facts.
- **H2H-RECOVERY-001** Unknown delivery or action outcomes remain visibly uncertain
  until reconciled; neither network failure nor a retry produces invented success.
- **H2H-HELPER-001** The standalone helper retains private durable run/event state,
  validates local workspace paths, uses HTTPS except loopback, and never runs
  an unreviewed command from a customer or server message.

Verification status and external proof belong in HANDOVER.md. No uncovered
requirement is silently treated as passing because the application compiled.
