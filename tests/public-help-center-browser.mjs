import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createRuntime } from './helpers/emitted-runtime.mjs'

const { chromium } = await import(process.env.H2H_PLAYWRIGHT_MODULE || 'playwright')
const phase = process.env.H2H_HELP_CENTER_PHASE || 'after'
const evidenceRoot = resolve(process.env.H2H_EVIDENCE_DIR || join(process.cwd(), 'test-results', 'help-center'))
const evidence = join(evidenceRoot, phase)
await mkdir(evidence, { recursive: true })

const runtime = await createRuntime()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const failures = []
const metrics = []
let success = false

page.on('requestfailed', request => failures.push({ type: 'request', url: request.url(), error: request.failure()?.errorText }))
page.on('response', response => {
  const request = response.request()
  if (response.status() >= 400 && ['stylesheet', 'image', 'font', 'script'].includes(request.resourceType())) {
    failures.push({ type: 'response', status: response.status(), url: response.url(), resourceType: request.resourceType() })
  }
})

try {
  const fixture = await runtime.seedTenant({
    name: 'Help Center Fixture',
    email: 'help-center-fixture@example.test',
    allowedOrigin: runtime.origin,
  })
  const authHeaders = { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }
  const write = async (path, body) => {
    const response = await fetch(runtime.origin + path, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) })
    const text = await response.text()
    assert.equal(response.status, 201, `${path}: ${response.status} ${text}`)
    return JSON.parse(text)
  }
  const category = await write(`/api/knowledge/${fixture.projectId}/categories`, {
    name: 'Getting started',
    slug: 'getting-started',
    summary: 'Set up your workspace and answer common questions.',
  })
  const nested = await write(`/api/knowledge/${fixture.projectId}/categories`, {
    name: 'Account access',
    slug: 'account-access',
    parentId: category.id,
    summary: 'Sign in and manage access.',
  })
  await write(`/api/knowledge/${fixture.projectId}/articles`, {
    slug: 'quick-start',
    title: 'Quick start',
    summary: 'Create a workspace and invite your team.',
    content: '# Quick start\n\nFollow these steps to **get started** with your workspace.',
    status: 'published',
    categoryIds: [category.id],
  })
  await write(`/api/knowledge/${fixture.projectId}/articles`, {
    slug: 'sign-in',
    title: 'Sign in',
    summary: 'Recover access to your account.',
    content: 'Use the sign-in page to access your account.',
    status: 'published',
    categoryIds: [nested.id],
  })
  await write(`/api/knowledge/${fixture.projectId}/articles`, {
    slug: 'uncategorized',
    title: 'Contact support',
    summary: 'Get help from the team.',
    content: 'Send the team a message when you need more help.',
    status: 'published',
  })

  const routes = [
    { id: 'index', path: `/${fixture.projectId}`, text: 'Getting started' },
    { id: 'search', path: `/${fixture.projectId}/search?keyword=workspace`, text: 'Quick start' },
    { id: 'article', path: `/${fixture.projectId}/quick-start`, text: 'Quick start' },
  ]
  for (const viewport of [{ id: 'desktop', width: 1440, height: 1000 }, { id: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const route of routes) {
      failures.length = 0
      const response = await page.goto(runtime.origin + route.path, { waitUntil: 'domcontentloaded' })
      assert.equal(response?.status(), 200, `${viewport.id}/${route.id}`)
      await page.getByText(route.text, { exact: true }).first().waitFor()
      assert.ok(await page.locator('input[type="search"]').count(), `${viewport.id}/${route.id} searchbox`)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${viewport.id}/${route.id} overflow`)
      assert.deepEqual(failures, [], `${viewport.id}/${route.id} asset failures`)
      const layout = await page.evaluate(() => {
        const nav = document.querySelector('[data-help-center-nav], .navbar')
        const main = document.querySelector('main')
        return {
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          navWidth: nav?.getBoundingClientRect().width,
          navHeight: nav?.getBoundingClientRect().height,
          mainTop: main?.getBoundingClientRect().top,
        }
      })
      metrics.push({ phase, viewport: viewport.id, route: route.id, ...layout })
      await page.screenshot({ path: join(evidence, `${viewport.id}-${route.id}.png`), fullPage: true })
    }
  }
  await page.goto(runtime.origin + `/${fixture.projectId}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="search"]').fill('workspace')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForURL(`**/${fixture.projectId}/search?keyword=workspace`)
  assert.equal(await page.getByRole('link', { name: 'Quick start', exact: true }).count(), 1)
  assert.equal((await fetch(runtime.origin + `/${fixture.projectId}/missing-article`)).status, 404)
  assert.equal((await fetch(runtime.origin + `/help/${fixture.projectId}/quick-start`)).status, 200)
  assert.equal((await fetch(runtime.origin + '/site-assets/css/theme.css')).status, phase === 'before' ? 200 : 404)
  success = true
} finally {
  await writeFile(join(evidence, 'metrics.json'), JSON.stringify({ phase, metrics, failures }, null, 2))
  await browser.close()
  await runtime.close(success)
}

console.log(JSON.stringify({ phase, evidence, metrics, failures }, null, 2))
