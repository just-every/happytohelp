/** Cloudflare may publish the route/bindings shortly after an upload succeeds. */
export async function waitForDeploymentHealth(url, {
  timeoutMs = 30_000,
  intervalMs = 2_000,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const deadline = now() + timeoutMs;
  let lastResult = 'no response';
  while (now() < deadline) {
    let response;
    try {
      response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, deadline - now()))) });
    } catch {
      lastResult = 'network error';
    }
    if (response) {
      if (response.ok) {
        let body; try { body = await response.clone().json(); } catch {}
        if (body?.status === 'ok' && body?.runtime === 'native-rer' && body?.database === 'reachable' && body?.files === 'reachable') return response;
        throw new Error('Deployment returned an unexpected health document.');
      }
      lastResult = `HTTP ${response.status}`;
      if (response.status !== 404 && response.status !== 503) {
        throw new Error(`Deployment health check failed at ${url}: ${lastResult}.`);
      }
    }
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(intervalMs, remaining));
  }
  throw new Error(`Deployment did not become healthy at ${url} within ${timeoutMs}ms; last result: ${lastResult}.`);
}
