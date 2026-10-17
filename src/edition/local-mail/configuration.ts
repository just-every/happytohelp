import type {Env} from '../../platform/env'

/** Only the local host sets these bindings. Request headers never select a sender. */
export function localMailOrigin(env: Env): string | null {
 if (env.H2H_LOCAL !== 'true' || env.EMAIL_PROVIDER !== 'development' || env.RER_INSTALLATION_ID) return null
 if (typeof env.APP_ORIGIN !== 'string') return null
 try {
  const url = new URL(env.APP_ORIGIN)
  if (url.origin !== env.APP_ORIGIN || !['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return null
  return url.origin
 } catch { return null }
}
