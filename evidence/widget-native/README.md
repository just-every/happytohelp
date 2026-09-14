# Local native widget proof — 14 September 2026

Actual Chromium loaded the standalone built widget from an independent local
host at 127.0.0.1:8800, using the emitted native Worker at 127.0.0.1:8797 with
isolated local D1/R2/DO state under `/tmp/h2h-widget-native-proof`. The fixture
projects/contacts/operator are test-only. No provider was invoked.

`browser.json` records eleven passing checks: exact cross-origin settings/session
CORS, Shadow DOM host isolation, widget message persistence, operator socket
reply, attachment upload/authenticated byte download, reload identity/transcript,
offline reconnect without duplicate messages, denied untrusted origin, denied
cross-project transcript, contact form update and 390px mobile panel containment.
No browser page errors or failed HTTP responses occurred on the final pass.
The contact email was independently read back through the authenticated native
management route and matched the submitted test value.

`desktop.png` and `mobile.png` show the original widget UI with the durable
conversation and attachment. `failed-attempt.png` retains the earlier failure:
media raw Responses lacked CORS headers, causing attachment-bearing reloads to
fail. The first middleware repair then broke immutable WebSocket 101 headers;
foundation fixed both and normalised reserved socket close codes. The final pass
exercised their combined behavior.

Tested standalone widget SHA-256:
`7b2f803dc34393a944133e03ac8ba791294fbe6482a41aab139702024b989823`.
Emitted Worker entry hash at proof:
`6b9d1b0c2760fdb2c52a9036ff14ae520a5a240b82a87601d4f5f61d37169079`.
These identify local bytes, not a git checkpoint, deployment, or provider proof.

`tests/widget-native-lost-response.mjs` additionally ran the real widget transport
against the emitted Worker and D1, deliberately discarding a successful HTTP
response after commit. Retrying the persisted immutable command after the
conversation revision advanced returned a duplicate receipt and exactly one
stored message. `tests/widget-transport.mjs` and `tests/plugin-sdk.mjs` passed
10 boundary tests. Streaming provider behavior and signed metadata remain in the
separate AI/identity module evidence; this browser run used an operator reply.

The repeatable final proof is `pnpm run test:widget-browser` after `pnpm run build`.
Set `PLAYWRIGHT_MODULE` (or `H2H_PLAYWRIGHT_MODULE`) to a locally installed Playwright module when it is not resolvable as `playwright`.
The wrapper applies all source migrations to a fresh isolated emitted Worker, creates both tenants and a random localhost embed origin, and runs browser, lost-response and concurrent operator/contact tests. It retains per-test logs and exact bundle hashes in `runtime.json`; failed Worker state/logs remain in the reported temporary directory. It uses no provider credentials.

Current wrapper writes to `$H2H_EVIDENCE_DIR/widget-native/`, or a fresh temporary evidence directory by default, keeping clean-clone verification clean. The evidence path is printed. The checked-in `runtime.json` records the successful 28-migration final local run, including both real-D1 contention/retry cases.
