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
assert.match(text, /Free and open source: chat widget, shared inbox, help centre and AI-suggested replies with sources\./)
for (const [id, title] of [['product', 'The product'], ['help-before-they-ask', 'Help before they ask'], ['agent', 'Your own agent can investigate'], ['yours-to-run', 'Yours to run']]) {
  assert.match(html, new RegExp(`<section[^>]+id="${id}"[^>]+aria-labelledby="[^"]+"`, 'i'), id)
  assert.ok(text.includes(title), title)
}
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
if (process.env.H2H_TEST_PROJECT_ID) {
 const project = process.env.H2H_TEST_PROJECT_ID
 for (const path of [`/${project}`, `/${project}/search`, `/${project}/search?keyword=test`, `/help/${project}`]) assert.equal((await fetch(origin + path)).status, 200, path)
 assert.equal((await fetch(`${origin}/${project}/never-published-${Date.now()}`)).status, 404)
}
console.log('Native homepage: workspace entry, retired-route denial, local assets and no public widget passed. Published Help Center checks: ' + (process.env.H2H_TEST_PROJECT_ID ? 'passed' : 'not requested'))
