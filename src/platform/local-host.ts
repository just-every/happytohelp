/** Loopback-only names: a public Worker route can never be addressed by these. */
export const loopbackHostnames = ['localhost', '127.0.0.1', '[::1]']

/**
 * A request is local development only when it addresses a loopback host and the
 * runtime has no public APP_ORIGIN. Deployments always configure APP_ORIGIN, so a
 * reverse proxy that forwards to loopback cannot turn a deployment into "local".
 */
export function localDevelopmentRequest(requestUrl: string, appOrigin: unknown) {
 if (!loopbackHostnames.includes(new URL(requestUrl).hostname)) return false
 if (appOrigin === undefined || appOrigin === null || appOrigin === '') return true
 try { return loopbackHostnames.includes(new URL(String(appOrigin)).hostname) } catch { return false }
}
