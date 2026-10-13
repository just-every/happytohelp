/** Preserve the response's policy and cookies while preventing proxy rewrites of
 * HTML before React hydrates it. Static HTML takes the same path as SSR HTML. */
export function withDocumentHeaders(response: Response): Response {
 if (response.status === 101 || (response as Response & { webSocket?: unknown }).webSocket || !/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type') || '')) return response
 const policy = response.headers.get('Cache-Control')
 if (policy?.split(',').some(directive => directive.trim().toLowerCase() === 'no-transform')) return response
 const document = new Response(response.body, response)
 document.headers.set('Cache-Control', policy ? `${policy}, no-transform` : 'no-transform')
 return document
}
