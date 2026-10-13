import {HTTPException} from 'hono/http-exception'
import {verifyPublicDns} from '../../site-preview/network'
import {boundedBody, safeOrigin} from '../../site-preview/proxy'
import {USER_AGENT, type Robots} from './robots'

/** A read that stops for a stated reason. `skipped` reasons are policy; `failed` reasons are the network or the site. */
export class SiteReadStop extends Error {
 readonly outcome: 'skipped' | 'failed'
 readonly reason: string
 constructor(outcome: 'skipped' | 'failed', reason: string) {
  super(reason)
  this.outcome = outcome
  this.reason = reason
 }
}

const REDIRECTS = [301, 302, 303, 307, 308]
const MAX_HOPS = 3
const PER_REQUEST_MS = 8000
export const MAX_REQUESTS = 14

export interface Fetched {status: number; type: string; text: string}

/** The one origin this read may talk to, or a `skipped` stop. Public HTTPS hostnames only. */
export function publicOrigin(value: string): string {
 try {
  const origin = safeOrigin(value)
  if (new URL(origin).hostname.endsWith('.localhost')) throw new Error('localhost')
  return origin
 } catch { throw new SiteReadStop('skipped', 'non_public_origin') }
}

/**
 * A GET limited to one origin: a public-DNS answer for the host before any request, manual redirects that
 * must stay on exactly that origin, bounded time and body, an identifying User-Agent, and no cookie or
 * authorization header. A hostname is resolved once per read because every hop is held to the same origin;
 * a redirect that leaves it is refused before anything is requested from the other host.
 */
export class SiteFetcher {
 readonly origin: string
 private readonly deadline: number
 private requests = 0
 private verified = false
 constructor(origin: string, deadline: number) {
  this.origin = origin
  this.deadline = deadline
 }

 async get(path: string, options: {max: number; allow?: Robots; accept?: string}): Promise<Fetched> {
  let target = new URL(path, this.origin + '/')
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
   if (target.origin !== this.origin) throw new SiteReadStop('failed', 'off_origin_redirect')
   if (options.allow && !options.allow(target.pathname + target.search)) throw new SiteReadStop('skipped', 'robots_disallowed')
   if (this.requests >= MAX_REQUESTS || Date.now() > this.deadline) throw new SiteReadStop('failed', 'budget_exhausted')
   if (!this.verified) {
    try { await verifyPublicDns(target.hostname) } catch (error) {
     if (error instanceof HTTPException && error.status === 400) throw new SiteReadStop('skipped', 'dns_not_public')
     throw new SiteReadStop('failed', 'dns_check_failed')
    }
    this.verified = true
   }
   this.requests++
   let response: Response
   try {
    response = await fetch(target.href, {method: 'GET', redirect: 'manual', headers: {'User-Agent': USER_AGENT, Accept: options.accept ?? 'text/html,application/xhtml+xml,*/*;q=0.5'}, signal: AbortSignal.timeout(PER_REQUEST_MS)})
   } catch { throw new SiteReadStop('failed', 'fetch_failed') }
   if (REDIRECTS.includes(response.status)) {
    const location = response.headers.get('Location')
    await response.body?.cancel().catch(() => undefined)
    if (!location) throw new SiteReadStop('failed', 'bad_redirect')
    try { target = new URL(location, target) } catch { throw new SiteReadStop('failed', 'bad_redirect') }
    continue
   }
   let bytes: Uint8Array
   try { bytes = await boundedBody(response, options.max) } catch (error) {
    if (error instanceof HTTPException && error.status === 413) throw new SiteReadStop('failed', 'body_too_large')
    throw new SiteReadStop('failed', 'fetch_failed')
   }
   return {status: response.status, type: (response.headers.get('Content-Type') ?? '').toLowerCase(), text: new TextDecoder('utf-8', {fatal: false}).decode(bytes)}
  }
  throw new SiteReadStop('failed', 'too_many_redirects')
 }
}
