import {createRequire} from 'node:module'
import {readdir, readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {migrationStatements} from './helpers/migration-statements.mjs'
import {createSites} from './helpers/site-read-sites.mjs'

// The site reading job end to end: enqueueSiteRead, the real queue and the consumer in src/jobs.ts, real D1.
// Only the outbound network is faked, and only inside outboundService.
const require = createRequire(import.meta.url)
const {build} = require(require.resolve('esbuild', {paths: [require.resolve('wrangler')]}))
const {Miniflare, convertV4MiniflareOptions} = require(require.resolve('miniflare', {paths: [require.resolve('wrangler')]}))

const bundle = await build({entryPoints: ['tests/site-read-worker.ts'], bundle: true, write: false, format: 'esm', platform: 'node', external: ['node:*'], loader: {'.sql': 'text'}, logLevel: 'silent'})
let DB
const sites = createSites({
 // The owner edits the name, and the scheduler gives up on the read, while the site is still being read.
 async onHome(host) {
  if (host !== 'racy.example.com') return
  await DB.prepare("UPDATE projects SET name='Typed by the owner' WHERE id='racy'").run()
  await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.site_read.state','uncertain') WHERE project_id='racy'").run()
 },
})
const mf = new Miniflare(convertV4MiniflareOptions({
 name: 'site-read-test', modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'],
 d1Databases: ['DB'], r2Buckets: ['FILES'], queueProducers: {JOBS: 'site-read-test'},
 queueConsumers: {'site-read-test': {maxBatchSize: 1, maxBatchTimeout: 0, maxRetries: 0}},
 outboundService: request => sites.handler(request),
}))

const call = (path, project) => mf.dispatchFetch(`https://app.example${path}?project=${project}`)
const settingsOf = async project => JSON.parse((await DB.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(project).first()).settings_json)
const readOf = async project => (await settingsOf(project)).site_read
// What the read leaves behind: the workspace's private knowledge source (what the assistant searches), and no article.
const datasets = project => DB.prepare('SELECT d.id,d.name,d.url,d.status,d.published_version,d.refresh_mode,d.next_refresh_at,d.source_input,v.semantic,v.embedding_model FROM knowledge_datasets d LEFT JOIN knowledge_versions v ON v.id=d.published_version WHERE d.project_id=?').bind(project).all().then(r => r.results)
const documents = project => DB.prepare('SELECT f.url,f.title,f.content FROM knowledge_documents f JOIN knowledge_datasets d ON d.published_version=f.version_id WHERE d.project_id=? ORDER BY f.title').bind(project).all().then(r => r.results)
const articleCount = async project => (await DB.prepare('SELECT count(*) n FROM knowledge_articles WHERE project_id=?').bind(project).first()).n
const nothingWritten = async (project, why) => {
 assert.equal((await datasets(project)).length, 0, `${why}: no source`)
 assert.equal((await DB.prepare('SELECT count(*) n FROM knowledge_documents WHERE id LIKE ?').bind(`${project}-%`).first()).n, 0, `${why}: no document`)
 assert.equal(await articleCount(project), 0, `${why}: no article`)
}
// The product's own knowledge routes, as the owner: the lexical search the assistant uses, the source list, its pages, deletion.
const ownerToken = new Map()
async function asOwner(project) {
 if (!ownerToken.has(project)) {
  const token = `owner-token-${project}`
  await DB.prepare('INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)').bind(`owner-${project}`, `owner-${project}@example.com`, 'Owner', Date.now()).run()
  await DB.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(project, `owner-${project}`).run()
  await DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,?,?,'owner',?)").bind(createHash('sha256').update(token).digest('hex'), `owner-${project}`, project, Date.now() + 3600000).run()
  ownerToken.set(project, token)
 }
 return ownerToken.get(project)
}
const api = async (project, path, init = {}) => mf.dispatchFetch(`https://app.example/api/knowledge/${project}${path}`, {...init, headers: {Authorization: `Bearer ${await asOwner(project)}`}})
const nameOf = async project => (await DB.prepare('SELECT name FROM projects WHERE id=?').bind(project).first()).name
const settle = async project => {
 for (let i = 0; i < 150; i++) {
  const state = (await readOf(project))?.state
  if (state && state !== 'queued' && state !== 'running') return readOf(project)
  await new Promise(resolve => setTimeout(resolve, 100))
 }
 assert.fail(`site read for ${project} did not settle: ${JSON.stringify(await readOf(project))}`)
}
let nextProject = 0
async function workspace(origin, {id = `p${++nextProject}`, name = 'Acme Example', settings} = {}) {
 await DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(id, name, `key-${id}`, origin, Date.now()).run()
 await DB.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?)').bind(id, JSON.stringify(settings ?? {primary_color: '#713ee0', derived: {name, colour: true}}), Date.now()).run()
 return id
}
const readSite = async project => { assert.equal((await (await call('/enqueue', project)).json()).result, 'queued'); return settle(project) }

try {
 DB = await mf.getD1Database('DB')
 for (const file of (await readdir('migrations')).filter(name => name.endsWith('.sql')).sort())
  for (const statement of migrationStatements(await readFile('migrations/' + file, 'utf8'))) {
   try { await DB.prepare(statement).run() } catch (error) { throw new Error(`${file}: ${error}`) }
  }

 // The page set and its limits, written as one private knowledge source and no article, by a read that respects robots and the origin.
 const acme = await workspace('https://acme.example.com')
 const done = await readSite(acme)
 assert.equal(done.state, 'done')
 const [source, ...others] = await datasets(acme)
 assert.equal(others.length, 0, 'exactly one knowledge source')
 assert.deepEqual([source.status, source.refresh_mode, source.semantic, source.embedding_model, source.next_refresh_at, source.source_input], ['ready', 'manual', 0, null, null, null], 'a lexical source nothing refreshes')
 assert.equal(source.url, 'https://acme.example.com')
 assert.ok(source.published_version && source.name, 'published, with a name')
 const pages = await documents(acme)
 assert.deepEqual(pages.map(page => page.title), ['Frequently asked questions', 'Getting started', 'Moved page', 'Shipping and returns'])
 assert.equal(done.pages, 4)
 assert.ok(pages.every(page => page.url.startsWith('https://acme.example.com/') && page.title && page.content), 'same-origin https pages with a title and content')
 const body = pages.find(page => page.title === 'Getting started').content
 assert.ok(body.includes('## Next steps') && body.includes('- Check your order number.') && !body.includes('Navigation') && !body.includes('Copyright'), 'page text is the body, without navigation or footer')
 assert.equal(await articleCount(acme), 0, 'no article of any status is written')
 const acmeRequests = sites.siteRequests()
 assert.ok(acmeRequests.every(r => r.host === 'acme.example.com'), 'no request leaves the origin')
 assert.ok(acmeRequests.every(r => !r.headers.cookie && !r.headers.authorization), 'no cookie or authorization header')
 assert.ok(acmeRequests.every(r => /HappyToHelp-Site-Reader/.test(r.headers['user-agent'])), 'identifying User-Agent')
 const paths = acmeRequests.map(r => r.path)
 assert.deepEqual(paths.slice(0, 2), ['/robots.txt', '/'], 'robots first, then home')
 assert.ok(!paths.some(p => p.startsWith('/private/')), 'robots.txt disallow respected')
 assert.ok(paths.includes('/help/new-page'), 'a same-origin redirect is followed')
 assert.ok(!paths.includes('/help/nav-only') && !paths.includes('/blog/post-1') && !paths.some(p => p.endsWith('.pdf')), 'only help-like pages')
 assert.equal(sites.requests.filter(r => r.kind === 'dns').every(r => r.host === 'acme.example.com'), true, 'DNS is checked for the origin only')
 assert.ok(sites.requests.some(r => r.kind === 'dns'), 'DNS was verified as public before reading')

 // The assistant can answer from it: lexical search (the mode search_knowledge uses) cites the page, with no model key,
 // embedding provider, crawler or file store configured, and without a request to anyone but the website.
 const found = await (await api(acme, '/search?q=frequently')).json()
 assert.equal(found.mode, 'lexical')
 assert.deepEqual(found.citations.map(citation => citation.url), ['https://acme.example.com/faq'])
 assert.equal(found.citations[0].title, 'Frequently asked questions')
 assert.equal((await (await api(acme, '/search?q=quasar-unrelated-word')).json()).citations.length, 0)
 assert.deepEqual((await (await api(acme, '/datasets')).json()).map(row => row.id), [source.id])
 assert.deepEqual((await (await api(acme, `/datasets/${source.id}/pages`)).json()).map(page => page.title).sort(), pages.map(page => page.title))
 assert.deepEqual(await (await api(acme, '/articles')).json(), [], 'no draft or published article')
 assert.deepEqual(await (await mf.dispatchFetch(`https://app.example/api/knowledge/public/${acme}/articles`)).json(), [], 'the public help routes list nothing')
 assert.equal((await mf.dispatchFetch(`https://app.example/api/knowledge/public/${acme}/search?q=frequently`)).status, 200)
 assert.deepEqual(await (await mf.dispatchFetch(`https://app.example/api/knowledge/public/${acme}/search?q=frequently`)).json(), [], 'the public help routes find nothing')
 assert.ok(sites.requests.every(r => r.host === 'acme.example.com'), 'nothing but the website was asked, search included')

 // Name and colour replaced while still the derived values.
 assert.equal(await nameOf(acme), 'Acme Widgets & Co')
 assert.equal((await settingsOf(acme)).primary_color, '#1a7f64')
 assert.deepEqual([done.name, done.colour], ['Acme Widgets & Co', '#1a7f64'])

 // Once only: a second enqueue, a duplicate delivery and the scheduler read nothing and write nothing.
 const before = sites.requests.length
 assert.equal((await (await call('/enqueue', acme)).json()).result, 'already')
 await call('/redeliver', acme)
 await call('/scheduled', acme)
 await new Promise(resolve => setTimeout(resolve, 500))
 assert.equal(sites.requests.length, before, 'no further request')
 assert.deepEqual([(await datasets(acme)).length, (await documents(acme)).length], [1, 4], 'no second source, no duplicate page')
 assert.equal((await readOf(acme)).state, 'done')

 // The owner's deletion sticks: the source goes through the product's route and no later read brings it back.
 assert.equal((await api(acme, `/datasets/${source.id}`, {method: 'DELETE'})).status, 200)
 assert.deepEqual([(await datasets(acme)).length, (await documents(acme)).length], [0, 0])
 assert.equal((await (await api(acme, '/search?q=frequently')).json()).citations.length, 0)
 assert.equal((await (await call('/enqueue', acme)).json()).result, 'already')
 await call('/redeliver', acme)
 await call('/scheduled', acme)
 await new Promise(resolve => setTimeout(resolve, 500))
 assert.deepEqual([(await datasets(acme)).length, (await readOf(acme)).state, sites.requests.length], [0, 'done', before], 'not re-created, not read again')

 // At most 8 help pages, however many the sitemap offers.
 const big = await workspace('https://big.example.com')
 sites.reset()
 assert.equal((await readSite(big)).pages, 8)
 assert.equal(sites.siteRequests().filter(r => r.path.startsWith('/help/')).length, 8)
 assert.equal((await documents(big)).length, 8)
 assert.equal((await datasets(big)).length, 1)
 assert.equal(await articleCount(big), 0)
 assert.ok(sites.siteRequests().length <= 11, 'robots, sitemap, home and 8 pages')

 // The owner's edits survive: nothing is replaced unless it still equals the derived value.
 const edited = await workspace('https://quiet.example.com', {name: 'Quiet', settings: {primary_color: '#ff0000', derived: {name: 'Quiet Derived', colour: true}}})
 await DB.prepare("UPDATE projects SET name='Our own name' WHERE id=?").bind(edited).run()
 assert.equal((await readSite(edited)).state, 'done')
 assert.equal(await nameOf(edited), 'Our own name')
 assert.equal((await settingsOf(edited)).primary_color, '#ff0000')
 assert.equal((await documents(edited)).length, 1, 'the source is still written')
 const half = await workspace('https://quiet.example.com', {name: 'Derived Name', settings: {primary_color: '#00aaff', derived: {name: 'Derived Name', colour: true}}})
 const halfDone = await readSite(half)
 assert.equal(await nameOf(half), 'Acme Widgets & Co', 'name still derived: replaced')
 assert.equal((await settingsOf(half)).primary_color, '#00aaff', 'colour was changed by the owner: kept')
 assert.equal(halfDone.colour, undefined)
 const fixed = await workspace('https://quiet.example.com', {name: 'Typed', settings: {primary_color: '#713ee0', derived: {name: null, colour: false}}})
 await readSite(fixed)
 assert.equal(await nameOf(fixed), 'Typed', 'no derived name: kept')
 assert.equal((await settingsOf(fixed)).primary_color, '#713ee0', 'colour was chosen, not derived: kept')

 // An edit made while the read is running, and a read the scheduler has already given up on, write nothing.
 const racy = await workspace('https://racy.example.com', {id: 'racy', name: 'Racy Derived', settings: {primary_color: '#713ee0', derived: {name: 'Racy Derived', colour: true}}})
 await call('/enqueue', racy)
 await new Promise(resolve => setTimeout(resolve, 1500))
 assert.equal(await nameOf(racy), 'Typed by the owner')
 assert.equal((await settingsOf(racy)).primary_color, '#713ee0')
 await nothingWritten(racy, 'a read marked uncertain mid-flight')
 assert.equal((await readOf(racy)).state, 'uncertain')

 // Refusals: non-public origins are skipped without a single request, DNS included.
 sites.reset()
 for (const origin of ['http://acme.example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://wiki.internal', 'https://printer.local', 'https://app.localhost', 'https://acme.example.com:8443', 'https://intranet']) {
  const project = await workspace(origin)
  const record = await readSite(project)
  assert.deepEqual([record.state, record.reason], ['skipped', 'non_public_origin'], origin)
  assert.equal(await nameOf(project), 'Acme Example')
  await nothingWritten(project, origin)
 }
 assert.equal(sites.requests.length, 0, 'nothing was requested for non-public origins')
 for (const origin of ['https://private-dns.example.com', 'https://nxdomain.example.com']) {
  const record = await readSite(await workspace(origin))
  assert.deepEqual([record.state, record.reason], ['skipped', 'dns_not_public'], origin)
 }
 assert.deepEqual(sites.siteRequests(), [], 'a private DNS answer stops the read before any site request')

 // robots.txt that disallows everything, a failing site and an off-origin redirect all leave the workspace untouched.
 sites.reset()
 const closed = await workspace('https://closed.example.com')
 assert.deepEqual([(await readSite(closed)).state, (await readOf(closed)).reason], ['skipped', 'robots_disallowed'])
 assert.deepEqual(sites.siteRequests().map(r => r.path), ['/robots.txt'])
 const down = await workspace('https://down.example.com')
 const downRecord = await readSite(down)
 assert.deepEqual([downRecord.state, downRecord.reason], ['failed', 'home_unreadable'])
 const bounce = await workspace('https://bounce.example.com')
 const bounced = await readSite(bounce)
 assert.deepEqual([bounced.state, bounced.reason], ['failed', 'off_origin_redirect'])
 assert.ok(!sites.requests.some(r => r.host === 'evil.example.net'), 'the redirect target was never contacted')
 for (const project of [closed, down, bounce]) {
  assert.equal(await nameOf(project), 'Acme Example')
  assert.equal((await settingsOf(project)).primary_color, '#713ee0')
  await nothingWritten(project, 'closed, down or bounced')
 }
 // No retry: the failed site was asked once, and neither a re-enqueue nor the scheduler asks again.
 const homeRequests = () => sites.siteRequests('down.example.com').filter(r => r.path === '/').length
 assert.equal(homeRequests(), 1)
 assert.equal((await (await call('/enqueue', down)).json()).result, 'already')
 await call('/scheduled', down)
 await new Promise(resolve => setTimeout(resolve, 500))
 assert.equal(homeRequests(), 1)

 // A read stuck running is marked uncertain by the scheduler and never repeated; a lost queue message is sent again.
 const stale = await workspace('https://quiet.example.com')
 await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.site_read',json(?)) WHERE project_id=?").bind(JSON.stringify({state: 'running', at: Date.now() - 10 * 60000}), stale).run()
 const lost = await workspace('https://quiet.example.com')
 await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.site_read',json(?)) WHERE project_id=?").bind(JSON.stringify({state: 'queued', at: Date.now() - 10 * 60000}), lost).run()
 const fresh = await workspace('https://quiet.example.com')
 await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.site_read',json(?)) WHERE project_id=?").bind(JSON.stringify({state: 'running', at: Date.now()}), fresh).run()
 sites.reset()
 await call('/scheduled', stale)
 assert.equal((await settle(lost)).state, 'done', 'a lost queue message is delivered again')
 assert.equal((await readOf(stale)).state, 'uncertain')
 assert.equal((await readOf(stale)).reason, 'interrupted')
 assert.equal((await readOf(fresh)).state, 'running', 'a recent running read is left alone')
 await call('/redeliver', stale)
 await new Promise(resolve => setTimeout(resolve, 500))
 await nothingWritten(stale, 'an uncertain read is not repeated')
 assert.equal(sites.siteRequests().length, 4, 'only the recovered queued read touched the site: robots, home, sitemap, one page')

 console.log({passed: 'site-read', runtime: 'workerd via Miniflare', database: 'real local D1', queue: 'real local Queue', networkFakedAt: 'outboundService only'})
} finally {
 await mf.dispose()
}
