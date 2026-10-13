import {anchors, decodeEntities, extractReadable, metaContent, tagsNamed, titleOf} from './html'

export const MAX_HELP_PAGES = 8

/** The site's own name: `og:site_name`, else the first segment of the home page title. */
export function siteName(home: string): string | null {
 const named = metaContent(home, 'property', 'og:site_name') || metaContent(home, 'name', 'application-name')
 const stem = titleOf(home).split(/\s+[|–—·-]\s+|\s*[|·]\s*|:\s+/)[0]?.trim() ?? ''
 const name = (named || stem).replace(/\s+/g, ' ').trim()
 return name && name.length <= 80 ? name : null
}

/** A brand colour from `theme-color`, as lowercase `#rrggbb`. Light-scheme values first; near-white is not a usable brand colour. */
export function siteColour(home: string): string | null {
 const tags = tagsNamed(home, 'meta').filter(tag => tag.attrs.name?.toLowerCase() === 'theme-color' && tag.attrs.content)
 const ordered = [...tags.filter(tag => !/dark/i.test(tag.attrs.media ?? '')), ...tags.filter(tag => /dark/i.test(tag.attrs.media ?? ''))]
 for (const tag of ordered) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(tag.attrs.content.trim())?.[1]
  if (!hex) continue
  const full = (hex.length === 3 ? [...hex].map(c => c + c).join('') : hex).toLowerCase()
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
  if (0.2126 * r + 0.7152 * g + 0.0722 * b > 0.9) continue
  return `#${full}`
 }
 return null
}

const HELP_WORDS = new Set(['help', 'faq', 'faqs', 'support', 'docs', 'documentation', 'guide', 'guides', 'howto', 'shipping', 'delivery', 'returns', 'return', 'refund', 'refunds', 'pricing', 'billing', 'account', 'contact', 'about', 'warranty', 'terms', 'privacy', 'policy', 'policies', 'knowledge', 'troubleshooting', 'questions', 'start', 'started'])
const NOT_PAGES = /\.(?:pdf|png|jpe?g|gif|webp|svg|ico|css|js|json|xml|zip|gz|mp4|mp3|woff2?|txt|csv|docx?|xlsx?)$/i

function score(url: URL, label: string): number {
 let path = url.pathname
 try { path = decodeURIComponent(path) } catch { /* keep the encoded path */ }
 const words = `${path.replace(/how-to/gi, 'howto')} ${label}`.toLowerCase().split(/[^a-z0-9]+/)
 return words.filter(word => HELP_WORDS.has(word)).length
}

/** Same-origin help-like pages, best first. Home, files, non-HTTP links and repeats are dropped. */
export function rankHelpLinks(origin: string, base: string, links: {href: string; text: string}[], limit = MAX_HELP_PAGES): string[] {
 const found = new Map<string, {score: number; order: number}>()
 links.forEach((link, order) => {
  let url: URL
  try { url = new URL(link.href, base) } catch { return }
  url.hash = ''
  if (url.origin !== origin || url.pathname === '/' || NOT_PAGES.test(url.pathname)) return
  const value = score(url, link.text)
  if (value < 1) return
  const known = found.get(url.href)
  if (known) known.score = Math.max(known.score, value)
  else found.set(url.href, {score: value, order})
 })
 return [...found].sort((a, b) => b[1].score - a[1].score || a[1].order - b[1].order).slice(0, limit).map(([href]) => href)
}

export const homeLinks = (home: string) => anchors(home)

/** `<loc>` addresses of a urlset. A sitemap index lists sitemaps, which are not followed. */
export function sitemapLocations(xml: string): {href: string; text: string}[] {
 if (/<sitemapindex[\s>]/i.test(xml)) return []
 return [...xml.matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi)].map(match => ({href: decodeEntities(match[1]), text: ''}))
}

export interface SitePage {url: string; title: string; content: string}

const MIN_TEXT = 200
const MAX_CONTENT = 20000

/** A page as a knowledge document, or null when it is not worth one (noindex, too thin, no title). */
export function pageToDocument(url: string, html: string): SitePage | null {
 if (/noindex/i.test(metaContent(html, 'name', 'robots'))) return null
 const {heading, text} = extractReadable(html)
 if (text.length < MIN_TEXT) return null
 const title = (heading || titleOf(html).split(/\s+[|–—·-]\s+/)[0] || '').trim().slice(0, 200)
 if (!title) return null
 return {url, title, content: text.slice(0, MAX_CONTENT)}
}
