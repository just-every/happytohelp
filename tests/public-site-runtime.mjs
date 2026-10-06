import assert from 'node:assert/strict'
const origin = process.env.H2H_TEST_ORIGIN
if (!origin) throw Error('Set H2H_TEST_ORIGIN to the real local native Worker with migrations applied')
const response = await fetch(origin + '/')
assert.equal(response.status, 200)
const html = await response.text()
assert.match(html, /<!doctype html>/i)
const text = html.replace(/<[^>]*>/g, '')
assert.match(html, /<h1[^>]+id="hero-title"[^>]*>.*Customer Support,.*Solved\./is)
assert.ok(text.includes('Customer Support, Solved.'), 'the server HTML reads exactly "Customer Support, Solved."')
assert.ok(text.includes('Your Codex or Claude fixes the problem and writes the reply. You press Send.'))
assert.ok(text.includes('100% free and open source.'))
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
assert.match(html, /<meta[^>]+name="description"[^>]+content="Customer support, solved\. Your Codex or Claude fixes the problem and writes the reply; you press Send\. Chat widget, shared inbox, help centre and suggested replies\. 100% free and open source, MIT licensed\."/)
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
assert.doesNotMatch(html, /waitlist|pricing|widget\.js|stripe|<\?php|@extends\(/i)
for (const asset of html.matchAll(/(?:src|href)="(\/(?:site-assets|homepage)\/[^"?]+)/g)) {
 assert.equal((await fetch(origin + asset[1])).status, 200, asset[1])
}
for (const path of ['/marketing', '/pricing', '/waitlist', '/features/sales', '/resources/install', '/company/terms', '/demo?website=https://example.com']) {
 assert.equal((await fetch(origin + path)).status, 404, path)
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
console.log('Native homepage: workspace entry, retired-route denial, local assets and no public widget passed. Published Help Center checks: ' + (process.env.H2H_TEST_PROJECT_ID ? 'passed' : 'not requested'))
