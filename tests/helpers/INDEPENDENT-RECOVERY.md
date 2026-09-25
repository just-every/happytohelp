# Independent artifact recovery qualification

`node tests/independent-runtime.mjs` runs the emitted artifact's own entrypoint
and authenticated application routes. It uploads and downloads binary media
through those routes before backup and downloads it again with the retained
owner session after restore.

The application is stopped before opening local D1/R2 bindings with Wrangler's
supported `getPlatformProxy` API. Remote bindings are disabled. Only the exact
isolated configuration's database and bucket are opened; the native persistence
path is shared with Wrangler's local commands. The proxy is disposed before a
CLI export or application restart, so two runtimes never own that storage at the
same time. This is test tooling, not an application endpoint or runtime fallback.

The check retains the original metadata-bearing binary object and compares every
application table (94 for this artifact), every object key, byte, HTTP metadata
and custom metadata value, and the entire SQL export after a fresh import.
Restored setup must refuse reinitialization, the prior session must read the
transcript and attachment, and a fresh password login must create a usable
session. Durable Object storage is not claimed as a complete portable export.

## Error-response regression and historical diagnostics

The former test-only HTTP `/__test` wrapper intermittently failed its first R2
inspection with a Wrangler development-proxy `Network connection lost` error.
Debug output also reported `Can't read from request stream after response has
been sent`. Its JSON read, R2 operations and response read were all awaited;
source inspection did not establish a wrapper misuse. Both worker-first and
unchanged asset-first controls subsequently passed, so worker-first routing was
rejected as a causal fix.

The stronger check then reproduced the same failure on the real authenticated
media upload immediately after the preview route rejected its input with 503.
The application error handler returned before consuming unread request bodies.
`tests/error-response.mjs` deterministically demonstrated that lifecycle defect
on the actual application handler: the original 401 response left its input
unconsumed. The handler now uses the existing bounded `rejectedResponse` helper
already used for unknown routes and CORS rejections. It preserves normal error
status and JSON while finishing the request; the helper's existing size and time
limits still apply. The preview rejection followed by actual media upload is
part of the emitted-artifact recovery check.

The exact internal stream responsible for the historical proxy exception was
not identified. No favorable rerun is treated as its diagnosis. Recovery now
uses supported native bindings instead of a private HTTP inspection endpoint,
and the real application upload/download assertions remain mandatory. No failed
operation is retried.
