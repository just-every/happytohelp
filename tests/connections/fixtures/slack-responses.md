# Slack documentation recordings

Recorded 2026-10-09 from official Slack documentation. These are documentation response examples played by the local receiver, not live Slack receipts. No account or Slack endpoint was called.

- https://docs.slack.dev/reference/methods/chat.postMessage/#response : `botAccepted` retains the exact `ok`, `channel`, and `ts` fields of the success example, omitting its unused nested message object. `botRejected` is the complete documented error example. The fixed example channel is a response fixture, independent of the requested test channel.
- https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/#handling-errors : incoming webhook success uses documented HTTP 200/plain `ok`; the documented forbidden administrative error uses HTTP 403/plain `action_prohibited`.

Native visitor text and outbound requests are produced by the real application. Only external response data are fixtures; tests retain request escaping, tenant recipient counts, restart deduplication, safe errors and secret absence assertions.
