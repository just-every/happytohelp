import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRuntime } from './helpers/emitted-runtime.mjs'

// Real-browser check of the /docs pages the build renders from the repository's Markdown (docs/site.json), against the
// emitted Worker. Needs a build (`pnpm run build`). H2H_TEST_PORT pins the Worker port; H2H_EVIDENCE_DIR keeps screenshots.
const { chromium } = await import(process.env.H2H_PLAYWRIGHT_MODULE || 'playwright')
const root = fileURLToPath(new URL('..', import.meta.url))
const evidence = resolve(process.env.H2H_EVIDENCE_DIR || join(process.cwd(), 'test-results', 'docs'))
await mkdir(evidence, { recursive: true })
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const { readManifest } = await import('../src/ui/docs/build/manifest.ts')
const pages = readManifest(root).pages
const repository = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).repository.url

// The H1 and the h2 sequence of a Markdown file as written today, outside fenced code, inline-code backticks removed.
function headings(source) {
  let fenced = false
  const lines = readFileSync(join(root, source), 'utf8').split('\n').filter(line => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    return !fenced
  })
  const text = line => line.replace(/^#+\s+/, '').replace(/`/g, '').trim()
  return { h1: text(lines.find(line => /^# /.test(line))), h2: lines.filter(line => /^## /.test(line)).map(text) }
}
const widths = [375, 390, 768, 860, 861, 1024, 1199, 1200, 1440, 1920]
const aqua = ['rgb(143, 227, 238)', 'rgb(214, 245, 250)', 'rgb(232, 249, 252)', 'rgb(90, 216, 236)']
const footerLinks = ['HappyToHelp', 'Docs', 'GitHub', 'Workspace', 'Set up', 'Log in', 'MIT licence']
const runtime = await createRuntime({ port: Number(process.env.H2H_TEST_PORT) || 0 })
const browser = await chromium.launch({ headless: true })
const fetched = new Map()
const fetchPage = async path => {
  if (!fetched.has(path)) {
    const response = await fetch(runtime.origin + path)
    fetched.set(path, { status: response.status, html: await response.text() })
  }
  return fetched.get(path)
}
let success = false

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const external = []
  page.on('request', request => { if (!request.url().startsWith(runtime.origin) && !request.url().startsWith('data:')) external.push(request.url()) })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const open = async (path, target = page) => {
    const response = await target.goto(runtime.origin + path, { waitUntil: 'networkidle' })
    await target.evaluate(() => document.fonts.ready)
    return response
  }
  const axe = async target => {
    if (!(await target.evaluate(() => Boolean(window.axe)))) await target.addScriptTag({ path: axePath })
    return target.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`))
  }

  const strokes = new Map()
  // Every page: the build embedded the current Markdown, in the homepage frame, with working links and a pager in order.
  for (const [index, entry] of pages.entries()) {
    const response = await open(entry.href)
    const label = entry.href
    assert.equal(response.status(), 200, label)
    assert.match(response.headers()['content-type'], /^text\/html/, label)
    const { h1, h2 } = headings(entry.source)
    assert.equal(await page.title(), entry.slug ? `${h1} · HappyToHelp docs` : 'HappyToHelp docs', `${label} title`)
    assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 20, `${label} description`)
    assert.deepEqual(await page.locator('h1').allTextContents(), [h1], `${label} h1 is the Markdown H1`)
    assert.deepEqual((await page.locator('.docs-prose h2').allTextContents()).map(text => text.trim()), h2, `${label} h2s are the Markdown's, in order`)
    assert.equal(await page.locator('.site-header .brand').getAttribute('href'), '/', label)
    assert.deepEqual(await page.locator('.site-header nav a').evaluateAll(links => links.map(link => [link.textContent, link.getAttribute('href'), link.getAttribute('aria-current')])), [['Docs', '/docs', 'true'], ['GitHub', repository, null], ['Get the code', repository, null]], `${label} header`)
    assert.deepEqual(await page.locator('footer a').allInnerTexts(), footerLinks, `${label} footer`)
    assert.equal(await page.locator('footer a', { hasText: 'MIT licence' }).getAttribute('href'), `${repository}/blob/main/LICENSE`)
    // Landmarks: one banner, one visible Documentation navigation, main with the pager, the footer, one h1.
    assert.equal(await page.getByRole('banner').count(), 1, `${label} banner`)
    assert.equal(await page.getByRole('navigation', { name: 'Documentation' }).count(), 1, `${label} one Documentation nav`)
    assert.equal(await page.getByRole('main').locator('nav[aria-label="Previous and next pages"]').count(), 1, `${label} pager in main`)
    assert.equal(await page.getByRole('contentinfo').count(), 1, `${label} footer landmark`)
    assert.deepEqual(await page.locator('.docs-sidebar a[aria-current="page"]').allTextContents(), [entry.label], `${label} current page in the sidebar`)
    // The title's own pen stroke: decorative, ink, under the title, its own on every page.
    const stroke = await page.locator('.docs-title-line').evaluate(line => {
      const svg = line.querySelector('svg.docs-title-stroke'), title = line.querySelector('h1').getBoundingClientRect(), box = svg.getBoundingClientRect()
      return { name: svg.dataset.stroke, hidden: svg.getAttribute('aria-hidden'), colour: getComputedStyle(svg).color, below: box.top >= title.bottom - 1, within: box.left >= title.left - 4 && box.width <= title.width + 1 && box.width > 40 }
    })
    assert.deepEqual({ ...stroke, name: typeof stroke.name }, { name: 'string', hidden: 'true', colour: 'rgb(20, 20, 20)', below: true, within: true }, `${label} title stroke`)
    strokes.set(entry.href, stroke.name)
    // Previous and next follow docs/site.json; the edit link is the page's source.
    assert.equal(await page.locator('a[rel="prev"]').count() ? await page.locator('a[rel="prev"]').getAttribute('href') : null, pages[index - 1]?.href ?? null, `${label} previous`)
    assert.equal(await page.locator('a[rel="next"]').count() ? await page.locator('a[rel="next"]').getAttribute('href') : null, pages[index + 1]?.href ?? null, `${label} next`)
    assert.equal(await page.getByRole('link', { name: 'Edit this page on GitHub' }).getAttribute('href'), `${repository}/edit/main/${entry.source}`)
    // Every link in the text resolves: docs pages and their anchors, anchors on this page, and GitHub paths that exist.
    const markdown = readFileSync(join(root, entry.source), 'utf8')
    for (const href of await page.locator('.docs-prose a, .docs-toc a, .docs-toc-compact a').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
      if (href.startsWith('/docs')) {
        const [path, hash] = href.split('#')
        const target = await fetchPage(path)
        assert.equal(target.status, 200, `${label}: ${href}`)
        if (hash) assert.ok(target.html.includes(`id="${hash}"`), `${label}: ${href} anchor`)
      } else if (href.startsWith('#')) {
        assert.ok(await page.evaluate(id => Boolean(document.getElementById(id)), decodeURIComponent(href.slice(1))), `${label}: ${href} anchor`)
      } else if (href.startsWith(`${repository}/`) && !markdown.includes(href)) {
        const match = new RegExp(`^${repository}/(blob|tree)/main/([^#]+)`).exec(href)
        assert.ok(match && existsSync(join(root, match[2])), `${label}: ${href} names an existing repository path`)
      } else assert.match(href, /^(https?:|mailto:)/, `${label}: ${href}`)
    }
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
      assert.deepEqual(await axe(page), [], `${label} axe at ${width}px`)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  assert.equal(new Set(strokes.values()).size, pages.length, 'every page has its own title stroke')
  assert.deepEqual(external, [], 'the docs make no third-party request')
  assert.deepEqual(errors, [], 'no page errors')

  // Layout at every width, on every page: no sideways scroll, one Documentation navigation, the lockup on one line.
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    for (const entry of pages) {
      await open(entry.href)
      const label = `${entry.href} at ${width}px`
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${label} overflow`)
      const navs = await page.getByRole('navigation', { name: 'Documentation' }).evaluateAll(navs => navs.map(nav => nav.className))
      assert.deepEqual(navs, [width >= 861 ? 'docs-sidebar' : 'docs-menu'], `${label} navigation`)
      if (entry.slug === 'operations') {
        assert.equal(await page.locator('.docs-toc').isVisible(), width >= 1200, `${label} contents column`)
        assert.equal(await page.locator('.docs-toc-compact').isVisible(), width < 1200, `${label} compact contents`)
      }
      const header = await page.locator('.site-header').evaluate(header => {
        const brand = header.querySelector('.brand'), box = brand.getBoundingClientRect(), mark = brand.querySelector('svg.brand-mark').getBoundingClientRect(), word = brand.querySelector('svg.brand-word').getBoundingClientRect()
        const nav = [...header.querySelectorAll('nav a')].map(a => a.getBoundingClientRect())
        return { wordBesideMark: word.left >= mark.right && word.top < mark.bottom && word.bottom > mark.top && word.left >= box.left - 0.5 && word.right <= box.right + 0.5, clearOfNav: nav.every(a => a.left >= box.right || a.top >= box.bottom || a.bottom <= box.top), onScreen: box.left >= 0 && box.right <= innerWidth }
      })
      assert.deepEqual(header, { wordBesideMark: true, clearOfNav: true, onScreen: true }, `${label} header lockup`)
    }
  }

  // Measure: a comfortable line length for running text on the widest screens.
  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/docs/privacy', '/docs/operations']) {
      await open(path)
      // Lines are the distinct rows of the paragraph's text rects; inline code sits a little higher than the words beside it,
      // so rects whose centres are within half a line of each other are one row.
      const perLine = await page.locator('.docs-prose > p').evaluateAll(paragraphs => paragraphs.flatMap(p => {
        const range = document.createRange()
        range.selectNodeContents(p)
        const half = parseFloat(getComputedStyle(p).lineHeight) / 2
        const centres = [...range.getClientRects()].filter(rect => rect.width > 0).map(rect => rect.top + rect.height / 2).sort((a, b) => a - b)
        const lines = centres.filter((centre, index) => index === 0 || centre - centres[index - 1] > half).length
        return lines >= 2 ? [p.textContent.replace(/\s+/g, ' ').trim().length / lines] : []
      }).sort((a, b) => a - b))
      const median = perLine[Math.floor(perLine.length / 2)]
      assert.ok(perLine.length >= 3 && median >= 55 && median <= 80, `${path} at ${width}px: median ${median} characters per line`)
    }
  }

  // Type and colour: Outfit, monospace code, 17px prose; aqua only on the current item and the underlines.
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await open('/docs')
    const type = await page.evaluate(() => {
      const families = new Set()
      const walker = document.createTreeWalker(document.querySelector('.h2h-docs'), NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent.trim() && !node.parentElement.closest('pre, code')) families.add(getComputedStyle(node.parentElement).fontFamily.split(',')[0])
      }
      const prose = getComputedStyle(document.querySelector('.docs-prose'))
      return { families: [...families], code: getComputedStyle(document.querySelector('.docs-prose code')).fontFamily.split(',')[0], size: prose.fontSize, leading: parseFloat(prose.lineHeight) / parseFloat(prose.fontSize) }
    })
    assert.deepEqual(type.families, ['Outfit'], `every text outside code is Outfit at ${width}px`)
    assert.equal(type.code, 'ui-monospace')
    assert.equal(type.size, '17px')
    assert.ok(type.leading >= 1.6, `prose line height ${type.leading}`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const path of ['/docs', '/docs/operations', '/docs/privacy']) {
    await open(path)
    const colours = await page.evaluate(aqua => {
      const parse = value => { const match = /rgba?\(([^)]+)\)/.exec(value); if (!match) return null; const [r, g, b, a = 1] = match[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
      const allowed = (el, prop) => (prop === 'backgroundColor' && el.matches('nav a[aria-current="page"]')) || (prop === 'textDecorationColor' && el.matches('.docs-prose a, .site-header nav a[aria-current]'))
      const found = []
      for (const el of document.querySelectorAll('.h2h-docs, .h2h-docs *')) {
        if (el.closest('.brand-mark')) continue
        for (const pseudo of [null, '::before', '::after']) {
          const style = getComputedStyle(el, pseudo)
          if (pseudo && style.content === 'none') continue
          for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'textDecorationColor', 'outlineColor']) {
            if (prop.startsWith('border') && (style[prop.replace('Color', 'Style')] === 'none' || parseFloat(style[prop.replace('Color', 'Width')]) === 0)) continue
            if (prop === 'outlineColor' && style.outlineStyle === 'none') continue
            if (prop === 'textDecorationColor' && style.textDecorationLine === 'none') continue
            const colour = parse(style[prop])
            // Neutral and warm-neutral (paper, ink, greys) have almost no chroma; anything else is a hue.
            if (!colour || colour.a === 0 || Math.max(colour.r, colour.g, colour.b) - Math.min(colour.r, colour.g, colour.b) < 16) continue
            const value = `rgb(${colour.r}, ${colour.g}, ${colour.b})`
            if (!aqua.includes(value) || pseudo || !allowed(el, prop)) found.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''} ${prop} ${value}`)
          }
        }
      }
      return found
    }, aqua)
    assert.deepEqual(colours, [], `${path}: the only hue is aqua, on the current item and the link underlines`)
  }
  await open('/docs')
  const look = await page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(selector))
    const current = document.querySelector('.docs-sidebar a[aria-current="page"]')
    return {
      current: [getComputedStyle(current).backgroundColor, Number(getComputedStyle(current).fontWeight) >= 600],
      underline: style('.docs-prose p a').textDecorationColor,
      header: [style('.site-header nav a[aria-current]').textDecorationColor, style('.site-header nav a[aria-current]').textDecorationLine],
      code: style('.docs-prose p code').color,
      pre: style('.docs-prose pre').backgroundColor,
      title: style('.docs-title').fontWeight,
    }
  })
  assert.deepEqual(look, { current: ['rgb(214, 245, 250)', true], underline: 'rgb(90, 216, 236)', header: ['rgb(90, 216, 236)', 'underline'], code: 'rgb(20, 20, 20)', pre: 'rgba(255, 255, 255, 0.62)', title: '600' })
  await open('/docs/privacy')
  assert.deepEqual(await page.locator('.docs-table').first().evaluate(region => [region.getAttribute('role'), region.getAttribute('tabindex'), region.getAttribute('aria-label').startsWith('Table:')]), ['region', '0', true])

  // Keyboard: skip link, focus rings on links, summaries and table regions, the phone menu, and contents links.
  await open('/docs/security')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to the content')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'docs-content')
  const ring = selector => page.evaluate(selector => { const style = getComputedStyle(document.activeElement); return [document.activeElement.matches(selector), style.outlineStyle, parseFloat(style.outlineWidth) >= 2] }, selector)
  // Tabbing on from the top of the page reaches the table region and a link in the text, each with the ring.
  const reached = new Set()
  for (let tab = 0; tab < 40 && reached.size < 2; tab++) {
    await page.keyboard.press('Tab')
    for (const selector of ['.docs-table', '.docs-prose a[href]']) {
      if (reached.has(selector) || !(await page.evaluate(selector => document.activeElement.matches(selector), selector))) continue
      assert.deepEqual(await ring(selector), [true, 'solid', true], `${selector} shows the ink ring`)
      reached.add(selector)
    }
  }
  assert.equal(reached.size, 2, 'Tab reaches the table region and a link in the text')
  await page.setViewportSize({ width: 390, height: 844 })
  await open('/docs')
  for (let tab = 0; tab < 12 && !(await page.evaluate(() => document.activeElement.matches('.docs-menu summary'))); tab++) await page.keyboard.press('Tab')
  assert.deepEqual(await ring('.docs-menu summary'), [true, 'solid', true], 'the Docs menu summary is reached by Tab and shows the ring')
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.docs-menu details').evaluate(details => details.open), true, 'Enter opens the Docs menu')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Overview')
  await page.screenshot({ path: join(evidence, 'docs-390-menu-open.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  await open('/docs/operations')
  await page.locator('.docs-toc').getByRole('link', { name: 'Contact erasure', exact: true }).click()
  await page.waitForFunction(() => location.hash === '#contact-erasure')
  await page.waitForFunction(() => { const top = document.getElementById('contact-erasure').getBoundingClientRect().top; return top >= 0 && top <= 80 }, null, { timeout: 5000 })
  await page.waitForTimeout(600)
  const settled = await page.evaluate(() => [location.pathname, document.getElementById('contact-erasure').getBoundingClientRect().top])
  assert.ok(settled[0] === '/docs/operations' && settled[1] >= 0 && settled[1] <= 80, `the contents link brings its heading into view: ${settled}`)

  // From the homepage into the docs.
  await open('/')
  await page.locator('.hero-copy').getByRole('link', { name: 'Read the docs' }).click()
  await page.waitForURL(`${runtime.origin}/docs`)
  assert.equal(await page.locator('h1').textContent(), 'HappyToHelp')
  await open('/')
  await page.getByRole('link', { name: 'Read the installation guide' }).click()
  await page.waitForURL(`${runtime.origin}/docs/install`)
  assert.equal(await page.locator('h1').textContent(), 'Install HappyToHelp')

  // Unknown pages are the branded 404; /docs/ ends on the docs home.
  for (const path of ['/docs/does-not-exist', '/docs/Install', '/docs/index', '/docs/a/b']) {
    const response = await open(path)
    assert.equal(response.status(), 404, path)
    assert.equal(await page.title(), 'Page not found · HappyToHelp', path)
    assert.equal(await page.locator('h1').textContent(), 'Page not found.', path)
  }
  const slash = await open('/docs/')
  assert.equal(slash.status(), 200)
  assert.match(new URL(page.url()).pathname, /^\/docs\/?$/)
  assert.equal(await page.locator('h1').textContent(), 'HappyToHelp')
  const operations = await fetch(`${runtime.origin}/docs/operations`)
  const bytes = (await operations.arrayBuffer()).byteLength
  assert.ok(bytes <= 160 * 1024, `/docs/operations is ${bytes} bytes`)

  // Evidence.
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : width === 768 ? 1024 : 900 })
    for (const path of ['/docs', '/docs/install', '/docs/operations']) {
      await open(path)
      await page.screenshot({ path: join(evidence, `${path.slice(1).replace(/\//g, '-')}-${width}.png`), fullPage: true })
    }
  }
  await context.close()
  success = true
  console.log(`Docs: ${pages.length} pages match their Markdown (h1 and h2 order), every link and anchor resolves, layout holds at ${widths.join(', ')}px, measure 55-80 characters, Outfit and aqua-only accents, keyboard and axe clean, branded 404s, /docs/operations ${bytes} bytes`)
} finally {
  await browser.close()
  await runtime.close(success)
}
