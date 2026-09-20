import assert from 'node:assert/strict'
const origin = process.env.H2H_TEST_ORIGIN
if (!origin) throw Error('Set H2H_TEST_ORIGIN to the real local native Worker with migrations applied')
const response = await fetch(origin + '/')
assert.equal(response.status, 200)
const html = await response.text()
assert.match(html, /<!doctype html>/i)
assert.match(html, /<section[^>]+id="features"[^>]+aria-labelledby="features-title"/i)
assert.match(html, /<h2[^>]+id="features-title"[^>]*>Help before they need it\.<\/h2>/i)
assert.match(html, /data-map-section="hero"/i)
assert.match(html, /beacon-toy-loop\.mp4/i)
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
console.log('Native homepage: workspace entry, removed acquisition routes, no public widget, and retained published Help Center passed')
