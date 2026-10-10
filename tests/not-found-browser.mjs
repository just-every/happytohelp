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
  // The tab icons and the drawn mark and wordmark as the page carries them, to compare the no-project Help Center page with the app 404.
  const headIcons = page => page.locator('head link[rel="icon"], head link[rel="apple-touch-icon"]').evaluateAll(links => links.map(link => ['rel', 'type', 'sizes', 'href'].map(name => link.getAttribute(name))))
  const drawnLockup = (page, selector) => page.locator(selector).evaluate(lockup => [...lockup.querySelectorAll(':scope > svg')].map(svg => ({
    attributes: [...svg.attributes].filter(attribute => !['class', 'xmlns'].includes(attribute.name)).map(attribute => [attribute.name, attribute.value]).sort(),
    paths: [...svg.querySelectorAll('path')].map(path => [path.getAttribute('d'), path.getAttribute('transform'), getComputedStyle(path).stroke, getComputedStyle(path).strokeWidth]),
  })))
  let appIcons, appLockup

  for (const viewport of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const open = async path => {
      const response = await page.goto(runtime.origin + path, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      return response
    }

    // Application 404: the same page for mistyped, deep and dashboard-shaped paths, still HTTP 404.
    for (const path of ['/this-page-does-not-exist', '/foo/bar/baz', '/does-not-exist', '/docs/does-not-exist']) {
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
      assert.deepEqual(await page.locator('.site-header .brand').evaluate(brand => [[...brand.childNodes].map(node => node.nodeName.toLowerCase()), [...brand.querySelectorAll('svg')].map(svg => [svg.getAttribute('class'), svg.getAttribute('aria-hidden'), svg.getAttribute('focusable')]), brand.textContent]), [['svg', 'svg', 'span'], [['brand-mark', 'true', 'false'], ['brand-word', 'true', 'false']], 'HappyToHelp'], `${label} lockup`)
      assert.equal(await page.locator('.site-header').getByRole('link', { name: 'HappyToHelp', exact: true }).count(), 1, `${label} lockup name`)
      assert.deepEqual(await page.locator('head link[rel="icon"], head link[rel="apple-touch-icon"]').evaluateAll(links => links.map(link => `${link.rel} ${link.getAttribute('href')}`)), ['icon /homepage/media/brands/happytohelp-favicon.png', 'icon /homepage/media/brands/happytohelp-favicon.svg', 'apple-touch-icon /homepage/media/brands/happytohelp-apple-touch-icon.png'], `${label} favicons`)
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.h2h-home')).fontFamily.startsWith('Outfit')), true, `${label} Outfit`)
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(246, 242, 234)', `${label} paper background`)
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.pill--large')).backgroundColor), 'rgb(20, 20, 20)', `${label} black pill`)
      assert.ok(await noOverflow(page), `${label} overflow`)
      assert.deepEqual(await axeViolations(page), [], `${label} axe`)
      appIcons ??= await headIcons(page)
      appLockup ??= await drawnLockup(page, '.site-header .brand')
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
      if (known) {
        // A project's pages carry the project's brand only, never HappyToHelp's lockup or tab icons.
        assert.equal(await page.locator('.help-center-lockup, .help-center-brand svg').count(), 0, `${label} no HappyToHelp lockup`)
        assert.deepEqual(await headIcons(page), [], `${label} no HappyToHelp tab icons`)
      } else {
        // No project owns the page, so it is HappyToHelp's: the homepage's mark and drawn wordmark, and the application's tab icons.
        const brand = page.locator('.help-center-brand')
        assert.equal(await brand.getAttribute('href'), '/', `${label} brand links home`)
        assert.equal(await page.getByRole('link', { name: 'HappyToHelp Help Center', exact: true }).count(), 1, `${label} brand name`)
        assert.deepEqual(await brand.evaluate(link => [...link.querySelectorAll('.help-center-lockup')].map(lockup => [lockup.getAttribute('aria-hidden'), lockup.querySelectorAll(':scope > svg').length])), [['true', 2]], `${label} one decorative lockup of two drawings`)
        const lockup = await drawnLockup(page, '.help-center-lockup')
        assert.deepEqual(lockup.map(svg => svg.paths.map(([d, transform]) => [d, transform])), appLockup.map(svg => svg.paths.map(([d, transform]) => [d, transform])), `${label} the same mark and wordmark paths as the homepage lockup`)
        assert.deepEqual(lockup[1].attributes, appLockup[1].attributes, `${label} the same wordmark element as the homepage lockup`)
        assert.deepEqual([...new Set(lockup.flatMap(svg => svg.paths.map(([, , stroke]) => stroke)))].sort(), ['rgb(143, 227, 238)', 'rgb(255, 255, 255)'], `${label} white ink on the dark nav, aqua sparks`)
        assert.ok(await page.locator('.help-center-sr').evaluate(name => { const box = name.getBoundingClientRect(); return box.width <= 1 && box.height <= 1 }), `${label} the name is visually hidden`)
        assert.deepEqual(await headIcons(page), appIcons, `${label} the application's tab icons`)
        for (const [, , , href] of appIcons) assert.equal((await fetch(runtime.origin + href)).status, 200, `${label} ${href}`)
      }
      helpPages[`${viewport.id}/${id}`] = await (await fetch(runtime.origin + path)).text()
      await page.screenshot({ path: join(evidence, `${viewport.id}-help-${id.replace(/ /g, '-')}.png`), fullPage: true })
    }
    assert.equal(helpPages[`${viewport.id}/unpublished draft`], helpPages[`${viewport.id}/missing article`], `${viewport.id} a draft must be indistinguishable from a missing article`)
    await context.close()
  }
  success = true
  console.log('Not-found pages: branded application 404 (4 paths including an unknown docs page, 2 viewports), Help Center 404s without draft disclosure, axe clean')
} finally {
  await browser.close()
  await runtime.close(success)
}
