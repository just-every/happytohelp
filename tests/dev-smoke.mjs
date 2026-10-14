import assert from 'node:assert/strict'

// Smoke check of a running rer dev (or preview) server: the homepage, login and docs render and an unknown path or docs page gets the branded 404.
// An unknown one-segment path looks up a project of that name, so it needs the local D1 migrated first (`pnpm exec rer setup --answers .seed/local-answers.json`);
// on an unmigrated database the lookup throws and the server answers 500. This test says so instead of leaving a bare 500.
const origin = process.env.H2H_TEST_ORIGIN
if (!origin) throw new Error('Set H2H_TEST_ORIGIN to the running server, for example http://127.0.0.1:47472')
const started = Date.now()
for (const [path, status] of [['/', 200], ['/login', 200], ['/docs', 200], ['/docs/install', 200], ['/does-not-exist', 404], ['/docs/does-not-exist', 404]]) {
  const begun = Date.now()
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(120000) })
  const body = await response.text()
  assert.ok(!/no such table/i.test(body), `${path} reached an unmigrated database: run "pnpm exec rer setup --answers .seed/local-answers.json" before starting the dev server`)
  assert.equal(response.status, status, `${path} answered ${response.status}`)
  if (status === 404) {
    assert.match(body, /<title>Page not found · HappyToHelp<\/title>/)
    assert.match(body, /Back to the homepage/)
  }
  console.log(`${path} ${response.status} ${Date.now() - begun}ms`)
}
console.log(`dev smoke passed in ${Date.now() - started}ms`)
