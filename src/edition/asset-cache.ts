// Compiled assets use [name]-[hash] with an eight-character content digest.
// Cloudflare _headers wildcards cannot constrain that digest, so keep
// mutable public files on the asset binding's existing cache policy.
const compiledAsset = /^\/assets\/[A-Za-z0-9_$.-]+-[A-Za-z0-9_-]{8}\.(?:js|css|svg)$/
const compiledType = /^(?:text\/css|image\/svg\+xml|(?:text|application)\/(?:javascript|ecmascript))(?:;|$)/i

/** Apply only to responses returned by the static asset binding. */
export function withCompiledAssetCache(request: Request, response: Response): Response {
  if ((request.method !== 'GET' && request.method !== 'HEAD') ||
      request.headers.has('Authorization') || request.headers.has('Range') ||
      !compiledAsset.test(new URL(request.url).pathname) ||
      (response.status !== 200 && response.status !== 304) ||
      !compiledType.test(response.headers.get('Content-Type') || '') ||
      response.headers.has('Set-Cookie')) return response

  const cached = new Response(response.body, response)
  cached.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return cached
}
