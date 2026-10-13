// Fixture websites for tests/site-read.mjs. This is the network edge only: it answers what the module's outbound
// fetch asks of the outside world (DNS-over-HTTPS and the customer's site) and records every request it sees.

export const PUBLIC_IP = '93.184.216.34'
const DNS = {
 'acme.example.com': PUBLIC_IP, 'big.example.com': PUBLIC_IP, 'down.example.com': PUBLIC_IP, 'bounce.example.com': PUBLIC_IP,
 'closed.example.com': PUBLIC_IP, 'racy.example.com': PUBLIC_IP, 'quiet.example.com': PUBLIC_IP, 'private-dns.example.com': '10.0.0.5',
}

const filler = 'Our team answers this the same way every time, and the steps below are the ones we send to customers. '.repeat(4)
export const article = (title, body = filler) => `<!doctype html><html><head><title>${title} | Acme Widgets</title></head><body><nav><a href="/help/nav-only">Navigation</a></nav><main><h1>${title}</h1><p>${body}</p><h2>Next steps</h2><ul><li>Check your order number.</li><li>Reply to our email.</li></ul></main><footer>Copyright Acme</footer></body></html>`
const home = (links, head = '') => `<!doctype html><html><head><title>Acme Widgets | Quality gadgets for everyone</title><meta property="og:site_name" content="Acme Widgets &amp; Co"><meta name="theme-color" content="#1a7f64">${head}</head><body><nav>${links.map(href => `<a href="${href}">${href}</a>`).join('')}</nav><main><h1>Welcome</h1></main></body></html>`
const sitemap = paths => `<?xml version="1.0"?><urlset>${paths.map(path => `<url><loc>https://big.example.com${path}</loc></url>`).join('')}</urlset>`
const html = (text, init = {}) => new Response(text, {headers: {'Content-Type': 'text/html; charset=utf-8'}, ...init})
const redirect = (location, status = 302) => new Response(null, {status, headers: {Location: location}})

export function createSites(hooks = {}) {
 const requests = []
 const handler = async request => {
  const url = new URL(request.url)
  if (url.hostname === 'cloudflare-dns.com') {
   const name = url.searchParams.get('name'), address = DNS[name]
   requests.push({kind: 'dns', host: name})
   return Response.json(address && url.searchParams.get('type') === 'A' ? {Status: 0, Answer: [{type: 1, data: address}]} : {Status: address ? 0 : 3})
  }
  requests.push({kind: 'site', host: url.hostname, path: url.pathname + url.search, headers: Object.fromEntries(request.headers)})
  const {pathname} = url
  if (url.hostname === 'acme.example.com') {
   if (pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /private/\n')
   if (pathname === '/sitemap.xml') return new Response('missing', {status: 404})
   if (pathname === '/') return html(home(['/help/getting-started', '/faq', '/shipping-returns', '/help/old-page', '/help/leaky', '/help/huge', '/help/thin', '/help/noindex', '/private/help-internal', 'https://other.example.org/help', '/blog/post-1', '/static/help.pdf', 'mailto:help@acme.example.com']))
   if (pathname === '/help/getting-started') return html(article('Getting started'))
   if (pathname === '/faq') return html(article('Frequently asked questions'))
   if (pathname === '/shipping-returns') return html(article('Shipping and returns'))
   if (pathname === '/help/old-page') return redirect('/help/new-page')
   if (pathname === '/help/new-page') return html(article('Moved page'))
   if (pathname === '/help/leaky') return redirect('https://evil.example.net/steal')
   if (pathname === '/help/huge') return html(article('Huge page', 'x '.repeat(400000)))
   if (pathname === '/help/thin') return html('<html><head><title>Thin</title></head><body><main><h1>Thin</h1><p>Short.</p></main></body></html>')
   if (pathname === '/help/noindex') return html(article('Secret').replace('<head>', '<head><meta name="robots" content="noindex">'))
   return new Response('missing', {status: 404})
  }
  if (url.hostname === 'big.example.com') {
   if (pathname === '/robots.txt') return new Response('', {status: 404})
   if (pathname === '/sitemap.xml') return new Response(sitemap(Array.from({length: 12}, (_, i) => `/help/topic-${i + 1}`)), {headers: {'Content-Type': 'application/xml'}})
   if (pathname === '/') return html(home([]))
   const topic = /^\/help\/topic-(\d+)$/.exec(pathname)
   if (topic) return html(article(`Topic ${topic[1]}`))
   return new Response('missing', {status: 404})
  }
  if (url.hostname === 'closed.example.com') return pathname === '/robots.txt' ? new Response('User-agent: *\nDisallow: /\n') : html(home([]))
  if (url.hostname === 'down.example.com') return pathname === '/robots.txt' ? new Response('', {status: 404}) : new Response('down', {status: 503})
  if (url.hostname === 'bounce.example.com') return pathname === '/robots.txt' ? new Response('', {status: 404}) : redirect('https://evil.example.net/', 301)
  if (url.hostname === 'racy.example.com' || url.hostname === 'quiet.example.com') {
   if (pathname === '/robots.txt') return new Response('', {status: 404})
   if (pathname === '/sitemap.xml') return new Response('missing', {status: 404})
   if (pathname === '/') {
    await hooks.onHome?.(url.hostname)
    return html(home(['/help/start']))
   }
   if (pathname === '/help/start') return html(article('Start here'))
  }
  return new Response('missing', {status: 404})
 }
 return {handler, requests, siteRequests: host => requests.filter(r => r.kind === 'site' && (!host || r.host === host)), reset: () => { requests.length = 0 }}
}
