import {publicOrigin, SiteFetcher, SiteReadStop} from '../management/site-read/fetch'
import {anchors} from '../management/site-read/html'
import {NOT_PAGES, pageToDocument} from '../management/site-read/parse'
import {allowAll, parseRobots, type Robots} from '../management/site-read/robots'
import type {CrawlConfig} from './crawl'
import type {DocumentInput} from './providers'

/**
 * The built-in website reader: HappyToHelp fetches the pages of a website source itself, with no crawler account.
 * It reads plain HTML only (pages a browser must build with JavaScript come back empty), stays on the starting
 * address's site and path, honours robots.txt, follows links up to the saved depth and reads at most
 * BUILT_IN_PAGE_LIMIT pages. The cap keeps one read inside a Worker's free-plan request allowance (50 per
 * invocation: one DNS check, robots.txt and the pages). Larger sites use the crawler service (crawl.ts).
 */
export const BUILT_IN_PAGE_LIMIT = 40
const READ_BUDGET_MS = 180_000
const PAGE_MAX = 1_000_000
const USER_AGENT = 'HappyToHelp-Knowledge-Reader/1.0 (+https://happytohelp.com/docs/website-knowledge; reads the pages a workspace added as a knowledge source; honours robots.txt)'

/** A read that could not produce a source, in words the person who added the website can act on. */
export class WebsiteReadError extends Error {}

const isHtml = (type: string) => type.includes('text/html') || type.includes('application/xhtml')

/** An excluded-URL pattern as the form documents it: `*` matches within one path segment, `**` matches anything. */
export function excludedPattern(glob: string): RegExp {
 const source = glob.trim().split('**').map(part => part.split('*').map(text => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*')
 return new RegExp(`^${source}$`)
}

function plain(stop: SiteReadStop, start: URL): WebsiteReadError {
 const host = start.host
 const words: Record<string, string> = {
  non_public_origin: `${start.href} is not a public https:// website address. The built-in reader reads only public sites; addresses on this computer or a private network cannot be read.`,
  dns_not_public: `${host} was not found, or does not point to a public internet address, so it cannot be read. Check the address, then choose Refresh now.`,
  dns_check_failed: `${host} could not be looked up. Check the address, then choose Refresh now.`,
  robots_disallowed: `${host}’s robots.txt asks readers not to visit ${start.pathname}, so nothing was read.`,
  robots_unavailable: `${host} answered robots.txt with a server error. Try Refresh now later.`,
  off_origin_redirect: `${start.href} redirects to a different website. Add the address it redirects to instead.`,
  too_many_redirects: `${start.href} redirects too many times. Add the final address instead.`,
  bad_redirect: `${start.href} answered with a broken redirect.`,
  body_too_large: `The starting page at ${start.href} is larger than 1 MB, so it was not read.`,
  budget_exhausted: `${host} answered too slowly to read in time. Try Refresh now later.`,
  fetch_failed: `${start.href} could not be reached. Check the address and that the site is online, then choose Refresh now.`,
 }
 return new WebsiteReadError(words[stop.reason] ?? `${start.href} could not be read (${stop.reason}).`)
}

/** Whether a URL is inside the source: same site, and the starting path or below it. */
function within(url: URL, origin: string, scope: string): boolean {
 if (url.origin !== origin) return false
 if (scope === '/') return true
 const path = url.pathname.replace(/\/$/, '')
 return path === scope || path.startsWith(`${scope}/`)
}

export async function readWebsite(input: CrawlConfig): Promise<DocumentInput[]> {
 const start = new URL(input.url)
 start.hash = ''
 let origin: string
 try { origin = publicOrigin(start.href) } catch (error) { throw error instanceof SiteReadStop ? plain(error, start) : error }
 const limit = Math.min(input.max_crawl_pages ?? 100, BUILT_IN_PAGE_LIMIT), depth = input.max_crawl_depth ?? 3
 const excluded = (input.excluded_urls || []).filter(glob => glob.trim()).map(excludedPattern)
 const scope = start.pathname.replace(/\/$/, '') || '/'
 const fetcher = new SiteFetcher(origin, Date.now() + READ_BUDGET_MS, {maxRequests: limit + 6, userAgent: USER_AGENT})
 let robots: Robots
 try {
  const answer = await fetcher.get('/robots.txt', {max: 64_000, accept: 'text/plain,*/*;q=0.5'})
  if (answer.status >= 500) throw new SiteReadStop('failed', 'robots_unavailable')
  robots = answer.status >= 400 ? allowAll : parseRobots(answer.text)
 } catch (error) { throw error instanceof SiteReadStop ? plain(error, start) : error }

 const documents: DocumentInput[] = []
 const seen = new Set([start.href])
 const queue = [{url: start.href, level: 0}]
 while (queue.length && documents.length < limit) {
  const {url, level} = queue.shift()!
  const first = url === start.href
  let page
  try { page = await fetcher.get(url, {max: PAGE_MAX, allow: robots}) } catch (error) {
   if (!(error instanceof SiteReadStop)) throw error
   if (first) throw plain(error, start)
   if (error.reason === 'budget_exhausted') break
   continue
  }
  if (page.status !== 200 || !isHtml(page.type)) {
   if (first) throw new WebsiteReadError(page.status !== 200 ? `${start.href} answered HTTP ${page.status}. Check the address, then choose Refresh now.` : `${start.href} is not a web page (it answered ${page.type || 'an unknown type'}).`)
   continue
  }
  const document = pageToDocument(url, page.text)
  if (document) documents.push(document)
  if (level >= depth) continue
  for (const link of anchors(page.text)) {
   let next: URL
   try { next = new URL(link.href, url) } catch { continue }
   next.hash = ''
   if (seen.has(next.href) || !['http:', 'https:'].includes(next.protocol) || NOT_PAGES.test(next.pathname) || !within(next, origin, scope)) continue
   if (!robots(next.pathname + next.search) || excluded.some(pattern => pattern.test(next.href))) continue
   seen.add(next.href)
   queue.push({url: next.href, level: level + 1})
  }
 }
 if (!documents.length) throw new WebsiteReadError(`No readable pages were found at ${start.href}. A page needs a title and at least a paragraph of text in its HTML. Pages built entirely by JavaScript come back empty: for those, set up the crawler service (see “Larger sites” on this page).`)
 return documents
}
