import assert from 'node:assert/strict'
import { createRuntime } from './helpers/emitted-runtime.mjs'

if (!process.argv.includes('--help-entry')) {
const origin = process.env.H2H_TEST_ORIGIN
if (!origin) throw Error('Set H2H_TEST_ORIGIN to the real local native Worker with migrations applied')
const response = await fetch(origin + '/')
assert.equal(response.status, 200)
const html = await response.text()
assert.match(html, /<!doctype html>/i)
const text = html.replace(/<[^>]*>/g, '').replace(/\u00a0/g, ' ')
assert.match(html, /<h1[^>]+id="hero-title"[^>]*>.*Customer Support,.*Solved\./is)
assert.ok(text.includes('Customer Support, Solved.'), 'the server HTML reads exactly "Customer Support, Solved."')
assert.ok(text.includes('Your Codex or Claude fixes the problem and writes the reply. You press Send.'))
assert.ok(text.includes('100% free, open source alternative to Zendesk, Intercom, Help Scout and Freshdesk'))
for (const label of ['Maya', 'I can\u2019t turn on the Spanish version of my store.', 'Codex', 'Fixed. Spanish is live on Maya\u2019s store.', 'All done, Maya. Refresh and it\u2019s there.', 'Send', 'The customer asks', 'The agent fixes it', 'You press Send']) assert.ok(text.includes(label), `server-rendered hero shows ${label}`)
for (const retired of ['Work with your local agent', 'Internal note', 'Local agent', 'Resolve completed', 'Evidence and details', 'Verified', 'The same move for', 'Hand the conversation to']) assert.ok(!text.includes(retired), `server-rendered hero does not show ${retired}`)
const titles = ['Not just better. Free.', 'Help before they ask', 'The rest of your support desk', 'Try it beside what you have', 'Ready when you are.']
const positions = titles.map(title => text.indexOf(title))
assert.ok(positions.every((position, index) => position > 0 && (index === 0 || position > positions[index - 1])), 'sections are in order in the server HTML: ' + positions)
for (const [id, title] of [['free', 'Not just better. Free.'], ['help-before-they-ask', 'Help before they ask'], ['product', 'The rest of your support desk'], ['move-in', 'Try it beside what you have'], ['get-started', 'Ready when you are.']]) {
  assert.match(html, new RegExp(`<section[^>]+id="${id}"[^>]+aria-labelledby="[^"]+"`, 'i'), id)
  assert.ok(text.includes(title), title)
}
assert.doesNotMatch(html, /yours-to-run/, 'the Yours to run section is gone')
// Free means free: the server HTML carries no price, hosting, provider or Run Edit Run text, in markup or attributes.
assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/gi, ''), /US\$|\$\d|Cloudflare|\bhosting\b|\bhosted\b|\bproviders?\b|run\s?edit\s?run|runeditrun/i, 'no cost, hosting, provider or Run Edit Run text in the server HTML')
assert.ok(text.includes('HappyToHelp is 100% free and open source. Free as in code, and free as in cost.'))
assert.match(html, /<meta[^>]+name="description"[^>]+content="Customer support, solved\. Your Codex or Claude fixes the problem and writes the reply; you press Send\. Chat widget, shared inbox, help centre and suggested replies\. 100% free, open source alternative to Zendesk, Intercom, Help Scout and Freshdesk\. MIT licensed\."/)
assert.doesNotMatch(text, /How the handoff works|billing|invoice/i, 'the retired handoff detail and the billing example are gone')
assert.equal((html.match(/<figure[^>]+role="img"[^>]+aria-label="[^"]{40,}"/g) || []).length, 8, 'eight labelled drawings in the server-rendered page')
assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"]*\.(?:woff2?|css|js)\b/i, 'no third-party font, stylesheet or script')
assert.match(html, /<link[^>]+rel="preload"[^>]+href="\/fonts\/outfit\/outfit-latin-wght-normal\.woff2"/)
for (const font of ['/fonts/outfit/outfit-latin-wght-normal.woff2', '/fonts/outfit/outfit-latin-ext-wght-normal.woff2']) {
 const fontResponse = await fetch(origin + font)
 assert.equal(fontResponse.status, 200, font)
 assert.match(fontResponse.headers.get('content-type') || '', /font\/woff2/, font)
}
assert.doesNotMatch(html, /village|parallax|<img\b|Support\. Free\. Yours\./i)
for (const route of ['/projects', '/login', '/setup']) assert.ok(html.includes(`href="${route}"`), route)
// The documentation is served by the site itself, built from the repository's Markdown (docs/site.json).
for (const route of ['/docs', '/docs/install']) assert.ok(html.includes(`href="${route}"`), `the homepage links ${route}`)
for (const [path, title] of [['/docs', 'HappyToHelp'], ['/docs/install', 'Install HappyToHelp']]) {
 const docs = await fetch(origin + path)
 assert.equal(docs.status, 200, path)
 assert.match(docs.headers.get('content-type') || '', /^text\/html/, path)
 const page = await docs.text()
 assert.match(page, new RegExp(`<h1[^>]*class="docs-title"[^>]*>${title}</h1>`), `${path} h1`)
 assert.match(page, /class="h2h-home h2h-docs"/, `${path} uses the homepage frame`)
}
for (const path of ['/docs/does-not-exist', '/docs/Install']) {
 const missing = await fetch(origin + path)
 assert.equal(missing.status, 404, path)
 assert.match(await missing.text(), /<title>Page not found · HappyToHelp<\/title>/, path)
}
assert.doesNotMatch(html, /waitlist|pricing|widget\.js|stripe|<\?php|@extends\(/i)
for (const asset of html.matchAll(/(?:src|href)="(\/(?:site-assets|homepage)\/[^"?]+)/g)) {
 assert.equal((await fetch(origin + asset[1])).status, 200, asset[1])
}
for (const path of ['/marketing', '/pricing', '/waitlist', '/features/sales', '/company/terms', '/demo?website=https://example.com']) {
 assert.equal((await fetch(origin + path)).status, 404, path)
}
for (const page of ['install', 'widget-hash', 'javascript-api', 'javascript-options', 'values', 'safety']) {
 const response = await fetch(`${origin}/resources/${page}`, { redirect: 'manual' })
 assert.equal(response.status, 308, page)
 assert.equal(response.headers.get('location'), `/docs/legacy-entry-points#${page}`, page)
 const destination = await fetch(new URL(response.headers.get('location'), origin))
 assert.equal(destination.status, 200, 'documentation destination ' + page)
 assert.ok((await destination.text()).includes(`id="${page}"`), 'documentation anchor ' + page)
}
assert.equal((await fetch(origin + '/waitlist', {method: 'POST', body: new URLSearchParams({email: 'removed@example.invalid'})})).status, 404)
// Unknown application paths: a branded HTML 404 with a descriptive title, a message and links home and to the workspace.
for (const path of ['/this-page-does-not-exist', '/foo/bar/baz', '/does-not-exist', '/admin/x/y/z']) {
 const notFound = await fetch(origin + path)
 assert.equal(notFound.status, 404, path)
 assert.match(notFound.headers.get('content-type') || '', /^text\/html/, path)
 const page = await notFound.text()
 assert.match(page, /<title>Page not found · HappyToHelp<\/title>/, path)
 assert.match(page, /<h1[^>]*>Page not found\.<\/h1>/, path)
 assert.match(page, /<a [^>]*href="\/"[^>]*>Back to the homepage<\/a>/, path)
 assert.match(page, /<a [^>]*href="\/projects"[^>]*>Open your workspace<\/a>/, path)
 assert.match(page, /class="h2h-home"/, path)
 assert.doesNotMatch(page, /<body><h1>Not found<\/h1>/, path)
}
// Help Center 404s: HTML inside the Help Center frame, never text/plain.
for (const path of ['/help/no-such-project', '/help/no-such-project/no-such-article', '/help/a/b/c']) {
 const missing = await fetch(origin + path)
 assert.equal(missing.status, 404, path)
 assert.match(missing.headers.get('content-type') || '', /^text\/html/, path)
 assert.match(await missing.text(), /data-help-center-nav/, path)
}
if (process.env.H2H_TEST_PROJECT_ID) {
 const project = process.env.H2H_TEST_PROJECT_ID
 for (const path of [`/${project}`, `/${project}/search`, `/${project}/search?keyword=test`, `/help/${project}`]) assert.equal((await fetch(origin + path)).status, 200, path)
 for (const path of [`/${project}/never-published-${Date.now()}`, `/help/${project}/never-published-${Date.now()}`]) {
  const missing = await fetch(origin + path)
  assert.equal(missing.status, 404, path)
  assert.match(missing.headers.get('content-type') || '', /^text\/html/, path)
  const page = await missing.text()
  assert.match(page, /data-help-center-nav/, path)
  assert.match(page, /type="search"/, path)
 }
}
console.log('Native homepage: workspace entry, /docs pages and their 404s, retired-route denial, local assets and no public widget passed. Published Help Center checks: ' + (process.env.H2H_TEST_PROJECT_ID ? 'passed' : 'not requested'))

}

// A retained customer URL must pass the emitted Worker's real dispatch, not just the Help Center router.
async function helpEntryJourney() {
 const slug = 'retained-help-slug'
 const runtime = await createRuntime({ vars: {
  APP_ORIGIN: 'http://127.0.0.1',
  PUBLIC_HELP_HOSTS: JSON.stringify({ localhost: slug, '127.0.0.1': slug }),
 } })
 const helpOrigin = new URL(runtime.origin)
 helpOrigin.hostname = 'localhost'
 let success = false
 try {
  assert.equal((await fetch(new URL('/', helpOrigin))).status, 404, 'a configured host with an unknown project cannot expose a center')
  const tenant = await runtime.seedTenant({ name: 'Retained support', email: 'retained-help@example.test', allowedOrigin: runtime.origin })
  // The legacy importer retains aliases in this table. Fixture custody is separate from native identity.
  await runtime.execute(`INSERT INTO public_project_aliases(slug,project_id) VALUES('${slug}','${tenant.projectId}')`)
  const headers = { Authorization: `Bearer ${tenant.token}`, 'Content-Type': 'application/json' }
  const publish = async (owner, articleSlug, status) => {
   const response = await fetch(`${runtime.origin}/api/knowledge/${owner.projectId}/articles`, {
    method: 'POST', headers: { ...headers, Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ slug: articleSlug, title: articleSlug, summary: 'retained support guide', content: 'Retained instructions.', status }),
   })
   assert.equal(response.status, 201, await response.text())
  }
  await publish(tenant, 'retained-guide', 'published')
  await publish(tenant, 'private-guide', 'draft')
  const other = await runtime.seedTenant({ name: 'Other support', email: 'other-help@example.test', allowedOrigin: runtime.origin })
  await publish(other, 'foreign-guide', 'published')
  for (const base of [`/${tenant.projectId}`, `/${slug}`, `/help/${slug}`]) {
   for (const tail of ['', '/', '/search?keyword=retained', '/retained-guide']) {
    const response = await fetch(runtime.origin + base + tail)
    assert.equal(response.status, 200, base + tail)
    const html = await response.text()
    assert.ok(html.includes(`action="${base}/search"`), 'search stays on the retained path')
    if (!tail || tail.startsWith('/search')) assert.ok(html.includes(`href="${base}/retained-guide"`), 'article links retain their entry path')
   }
  }
  for (const path of ['/', '/search?keyword=retained', '/retained-guide']) {
   const response = await fetch(new URL(path, helpOrigin))
   assert.equal(response.status, 200, 'configured host ' + path)
   const html = await response.text()
   assert.ok(html.includes('action="/search"'), 'host search stays at its root')
   assert.ok(html.includes('class="help-center-brand" href="/"'), 'host brand returns to its root')
   if (path !== '/retained-guide') assert.ok(html.includes('href="/retained-guide"'), 'host article links stay at its root')
  }
  assert.equal((await fetch(new URL('/retained-guide', helpOrigin), { method: 'HEAD' })).status, 200)
  for (const path of ['/private-guide', '/foreign-guide', '/missing-guide']) {
   assert.equal((await fetch(new URL(path, helpOrigin))).status, 404, path)
  }
  for (const path of ['/', '/run']) {
   const response = await fetch(runtime.origin + path, { headers: { Forwarded: 'host=localhost', 'X-Forwarded-Host': 'localhost', 'X-Original-Host': 'localhost' } })
   if (path === '/') assert.equal(response.status, 200, 'canonical application root')
   assert.ok(response.status < 500, 'canonical application route remains available')
   assert.doesNotMatch(await response.text(), /data-help-center-nav/, 'configuration and forwarded headers cannot replace the application origin')
  }
  const privateResponse = await fetch(new URL('/api/management/projects', helpOrigin))
  assert.equal(privateResponse.status, 401, 'a configured help host does not turn a private API into public knowledge')
  assert.doesNotMatch(await privateResponse.text(), /data-help-center-nav/)
  const retired = await fetch(`${runtime.origin}/api/management/projects/${tenant.projectId}`, { method: 'DELETE', headers })
  assert.equal(retired.status, 200, await retired.text())
  for (const address of [new URL('/', helpOrigin), new URL('/search?keyword=retained', helpOrigin), new URL('/retained-guide', helpOrigin), new URL(`/${slug}`, runtime.origin), new URL(`/help/${slug}/retained-guide`, runtime.origin)]) {
   const response = await fetch(address)
   assert.equal(response.status, 404, 'retired project ' + address.pathname)
   assert.doesNotMatch(await response.text(), /retained-guide|Retained instructions/)
  }
  // The same explicit configuration can name a native id directly, without requiring a slug alias.
  await runtime.execute(`DELETE FROM public_project_aliases WHERE slug='${slug}'; INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('${slug}','Direct native help','direct-native-help','https://example.test',1); INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES('direct-guide','${slug}','direct-guide','Direct native guide','Native instructions.','published',1)`)
  for (const path of ['/', '/search?keyword=Native', '/direct-guide']) assert.equal((await fetch(new URL(path, helpOrigin))).status, 200, 'configured native id ' + path)
  success = true
 } finally { await runtime.close(success) }
 console.log('Emitted public help entry: native/imported slug paths, exact configured host root/search/article, app-origin preservation, draft/tenant/API/deleted fences passed')
}
await helpEntryJourney()
