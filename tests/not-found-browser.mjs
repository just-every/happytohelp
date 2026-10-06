import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createRuntime } from './helpers/emitted-runtime.mjs'

// Real-browser check of every 404 a visitor can reach: the branded application 404 and the Help Center 404s.
// Needs a build (`pnpm run build`). H2H_TEST_PORT pins the Worker port (inspector at port+1); H2H_EVIDENCE_DIR keeps screenshots.
const { chromium } = await import(process.env.H2H_PLAYWRIGHT_MODULE || 'playwright')
const evidence = resolve(process.env.H2H_EVIDENCE_DIR || join(process.cwd(), 'test-results', 'not-found'))
await mkdir(evidence, { recursive: true })
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const runtime = await createRuntime({ port: Number(process.env.H2H_TEST_PORT) || 0 })
const browser = await chromium.launch({ headless: true })
let success = false

try {
  const fixture = await runtime.seedTenant({ name: 'Northwind Help', email: 'not-found@example.test', allowedOrigin: runtime.origin })
  const headers = { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }
  for (const [slug, title, status] of [['quick-start', 'Quick start', 'published'], ['webhooks-draft', 'Webhooks and the API', 'draft']]) {
    const response = await fetch(`${runtime.origin}/api/knowledge/${fixture.projectId}/articles`, { method: 'POST', headers, body: JSON.stringify({ slug, title, summary: title, content: title, status }) })
    assert.equal(response.status, 201, await response.text())
  }

  const axeViolations = async page => {
    await page.addScriptTag({ path: axePath })
    return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`))
  }
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  const helpPages = {}

  for (const viewport of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const open = async path => {
      const response = await page.goto(runtime.origin + path, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      return response
    }

    // Application 404: the same page for mistyped, deep and dashboard-shaped paths, still HTTP 404.
    for (const path of ['/this-page-does-not-exist', '/foo/bar/baz', '/does-not-exist']) {
      const response = await open(path)
      const label = `${viewport.id} ${path}`
      assert.equal(response.status(), 404, label)
      assert.match(response.headers()['content-type'], /^text\/html/, label)
      assert.equal(await page.title(), 'Page not found · HappyToHelp', label)
      assert.equal(await page.locator('h1').count(), 1, label)
      assert.equal(await page.locator('h1').innerText(), 'Page not found.', label)
      assert.ok((await page.locator('main p').allInnerTexts()).some(text => /We can’t find the page you asked for/.test(text)), `${label} message`)
      assert.equal(await page.getByRole('link', { name: 'Back to the homepage' }).getAttribute('href'), '/', label)
      assert.equal(await page.getByRole('link', { name: 'Open your workspace' }).getAttribute('href'), '/projects', label)
      assert.equal(await page.locator('.site-header .brand').getAttribute('href'), '/', label)
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.h2h-home')).fontFamily.startsWith('Outfit')), true, `${label} Outfit`)
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(246, 242, 234)', `${label} paper background`)
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.pill--large')).backgroundColor), 'rgb(20, 20, 20)', `${label} black pill`)
      assert.ok(await noOverflow(page), `${label} overflow`)
      assert.deepEqual(await axeViolations(page), [], `${label} axe`)
    }
    await page.screenshot({ path: join(evidence, `${viewport.id}-app-404.png`), fullPage: true })
    // The way back works.
    await page.getByRole('link', { name: 'Back to the homepage' }).click()
    await page.waitForURL(runtime.origin + '/')
    await page.getByRole('heading', { level: 1, name: 'Customer Support, Solved.' }).waitFor()
    await open('/nothing/here')
    await page.getByRole('link', { name: 'Open your workspace' }).click()
    await page.waitForURL(url => !url.pathname.includes('nothing'))

    // Help Center 404s: HTML in the Help Center frame, and a draft looks exactly like a missing article.
    const projectBase = `/help/${fixture.projectId}`
    for (const [id, path, known] of [['missing article', `${projectBase}/nope`, true], ['unpublished draft', `${projectBase}/webhooks-draft`, true], ['unknown project', '/help/does-not-exist', false], ['unroutable help address', '/help/a/b/c', false]]) {
      const response = await open(path)
      const label = `${viewport.id} ${id}`
      assert.equal(response.status(), 404, label)
      assert.match(response.headers()['content-type'], /^text\/html/, label)
      assert.equal(await page.locator('[data-help-center-nav]').count(), 1, `${label} help-center header`)
      assert.equal(await page.locator('.help-center-brand').count(), 1, `${label} brand`)
      assert.equal(await page.locator('input[type="search"]').count(), known ? 1 : 0, `${label} search`)
      assert.ok(/Not found|can’t find/i.test(await page.locator('h1').innerText()), label)
      assert.ok(await noOverflow(page), `${label} overflow`)
      assert.deepEqual(await axeViolations(page), [], `${label} axe`)
      if (known) assert.equal(await page.locator('.help-center-content a').getAttribute('href'), projectBase, `${label} link to the article list`)
      else assert.equal(await page.locator('.help-center-content a').getAttribute('href'), '/', `${label} link home`)
      helpPages[`${viewport.id}/${id}`] = await (await fetch(runtime.origin + path)).text()
      await page.screenshot({ path: join(evidence, `${viewport.id}-help-${id.replace(/ /g, '-')}.png`), fullPage: true })
    }
    assert.equal(helpPages[`${viewport.id}/unpublished draft`], helpPages[`${viewport.id}/missing article`], `${viewport.id} a draft must be indistinguishable from a missing article`)
    await context.close()
  }
  success = true
  console.log('Not-found pages: branded application 404 (3 paths, 2 viewports), Help Center 404s without draft disclosure, axe clean')
} finally {
  await browser.close()
  await runtime.close(success)
}
