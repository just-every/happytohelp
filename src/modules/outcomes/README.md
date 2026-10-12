# Conversation outcomes

Native message admission records provenance in the same D1 transaction as the
message, frontier and outbox. Draft references must identify a stored, completed
proposal in the same workspace and conversation; local references also require
current device, grant and operator authority. A client that omits authorship
records an unknown answer.

`transitionConversation` is the shared operator assignment/resolve/reopen
operation. Pass a validated actor and the current session hash kept in request
context, separately from the actor's durable command identity. The transaction
rechecks that authority, the message frontier and resolution cycle, then records
one receipt that conditions assignment, AI cancellation and status together.
Message admission performs reply, assignment and send-and-close in one guarded
transaction, with the same resolution lifecycle triggers.

Native lifecycle tracking proves which forward cycles have complete history.
Imported rows are inert; migration backfills preserve historical source rows and
mark ambiguous cycle boundaries unknown. Reopening starts a separate cycle and
never transfers a prior resolution's rating. Only a current valid session of the
conversation's original contact may rate its currently closed resolution.

Migrations `112` and `113` intentionally follow the existing three-digit `020`,
`030` and `090` files in the installation's lexical migration ledger. They must
not be renamed to four-digit `0112`/`0113`, which would move the historical
backfill before its source tables on a fresh install.

`pnpm run test:reports` exercises native D1/Worker outcomes, current authority,
ratings, schema upgrades and browser behavior. It calls no model provider.
