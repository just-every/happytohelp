# Recorder preparation checks

Baseline: `38b4784cc49cae594e98ba635a24dddc3b18fa9d`.
Branch: `t/t-022/timed-recording`.

These are local recorder checks, not a live install recording or T-022 acceptance.
No installation, browser, screen/video capture, provider call, account creation,
credential read, GitHub operation or deployment ran. Tests started only temporary
Node subprocesses in owned process groups; each was terminated and temporary
files were removed. No server or watcher was started.

Qualified executable:
`/Users/zemaj/www/rer-fleet/4-front-door/scratch/toolchain/node_modules/node/bin/node`
reported `v26.8.1`.

- Initial bounded run: entry-point `--check` succeeded and
  `node --test verification/t-022/recorder/*.test.mjs` passed 10/10, 603.6 ms.
  This result was returned in tool output; it was not rerun to recover a log.
- At `2026-10-06T10:00:03Z`, every `.mjs` syntax check succeeded and the expanded
  11-case run passed 10/11. The added exited-command descendant test reproduced
  macOS `EPERM` on a redundant signal after losing process-group leadership.
  The original failure remains in `local-selfcheck-shutdown-failed.txt`.
- Correction: a small supervisor retains the owned session/group identity after
  the actual command exits. Shutdown signals that positively owned group and
  waits for its supervisor to close; it does not guess descendants by name or
  signal a stale identifier. Parent IPC disconnect kills the owned group.
- At `2026-10-06T10:02:01Z`, all `.mjs` syntax checks and the full expanded
  self-check command passed **11/11**, 392.3 ms. Output is retained in
  `local-selfcheck-final.txt`. This includes a command that exits while a child
  remains and proves the descendant is terminated.

The checks exercise fsynced/hash-chained custody, uninterrupted password time,
clock divergence and heartbeat gaps, strict 900-second timing, missing/short/
gapped media refusal, split-chunk credential-pattern refusal, command/process
custody, delivery-vs-acceptance, nonempty storage refusal, exact initial checklist
IDs/project, newly published article/conversation joins, and unknown-cost handling.

Actual screen capture/FFmpeg encoding/probing, live workflow/controller execution,
real credentials/providers, fresh owner setup, content/answer/citation correctness
and complete real <15-minute recording remain **unexecuted and blocked**. The
README identifies the implementation seams separately from existing owner inputs.
The integrator owns source-lock regeneration and final exact-source checks.
