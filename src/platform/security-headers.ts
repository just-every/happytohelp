type FramingEnv = { RER_MANAGEMENT_ORIGIN?: unknown; [binding: string]: unknown }

/**
 * application: operator documents and every API response. Only this origin and
 *   the configured RER management origin may frame them.
 * embeddable: published Help Center pages, which customers may frame on their
 *   own sites; they carry no framing restriction.
 * preview: the website-preview proxy on PREVIEW_ORIGIN owns its sandbox CSP and
 *   its framing contract (framed by the app origin), so it is left untouched.
 * The widget script and other built files are answered first by the Worker
 * entry (staticAssetResponse) and carry no application headers.
 */
export type HeaderSurface = 'application' | 'embeddable' | 'preview'

export function frameAncestors(env: FramingEnv) {
 const management = typeof env.RER_MANAGEMENT_ORIGIN === 'string' ? env.RER_MANAGEMENT_ORIGIN.trim() : ''
 return management ? ["'self'", new URL(management).origin] : ["'self'"]
}

export function headerSurface(path: string, publicSite: boolean): HeaderSurface {
 if (path.startsWith('/preview/')) return 'preview'
 return publicSite && !path.startsWith('/api/') ? 'embeddable' : 'application'
}

export function withSecurityHeaders(response: Response, surface: HeaderSurface, env: FramingEnv): Response {
 // A WebSocket upgrade must be returned as-is to keep its socket.
 if (surface === 'preview' || response.status === 101 || (response as Response & {webSocket?: unknown}).webSocket) return response
 const secured = new Response(response.body, response), headers = secured.headers
 if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff')
 if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
 if (surface === 'application') {
  const policy = headers.get('Content-Security-Policy')
  const stated = policy !== null && /(?:^|;)\s*frame-ancestors\s/i.test(policy)
  // A response that states both its frame-ancestors and X-Frame-Options (the delegation consent documents deny all framing) owns its framing contract.
  if (stated && headers.has('X-Frame-Options')) return secured
  const ancestors = frameAncestors(env), directive = `frame-ancestors ${ancestors.join(' ')}`
  if (!policy) headers.set('Content-Security-Policy', directive)
  else if (!stated) headers.set('Content-Security-Policy', `${policy}; ${directive}`)
  // X-Frame-Options cannot name another origin; only send it when no other framer is allowed.
  if (ancestors.length === 1) headers.set('X-Frame-Options', 'SAMEORIGIN')
  else headers.delete('X-Frame-Options')
 }
 return secured
}
