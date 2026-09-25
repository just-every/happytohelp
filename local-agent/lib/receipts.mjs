const MAX_TERMINAL_RESULT_RECEIPTS = 64;

/** Retain a result receipt that can no longer be recovered after access loss. */
export function retainDeniedResultReceipt(config, active) {
  const pending = active.pendingResult;
  if (!pending) return;
  const records = Array.isArray(config.terminalResultReceipts) ? config.terminalResultReceipts : [];
  records.push({
    jobId: active.jobId,
    runId: active.runId,
    eventId: pending.eventId,
    status: pending.status,
    result: pending.result,
    sessionId: pending.sessionId || null,
    deniedAt: new Date().toISOString(),
    httpStatus: 403,
    reason: 'workspace_access_lost',
  });
  config.terminalResultReceipts = records.slice(-MAX_TERMINAL_RESULT_RECEIPTS);
}
