import assert from 'node:assert/strict'
import {startApp,sha} from '../../journeys/kit/app.mjs'

// Workspace appearance through the owner/admin settings route and the widget's public settings: limits without
// truncation, Unicode and multiline text, safe images and colours, resets, every invalid value refused whole with
// stored bytes unchanged, role and tenant authority, and older stored invalid values hidden from the public brand.
export async function appearanceJourney(){
const app=await startApp({origin:'https://desk.example'}),DB=app.db
try{
const primary = await app.seedWorkspace('appearance'), other = await app.seedWorkspace('other-appearance')
const initial = {
 brand_name: 'Saved brand', welcome_message: 'Saved greeting', primary_color: '#123aBC', color: '#aabbcc',
 logo_url: 'https://images.example/logo.png', avatar_url: '/media/avatar.png', brand_image_url: 'http://localhost:5173/brand.svg',
 timezone: 'UTC', is_enabled: true, retained_setting: { private: 'retained' },
}
for (const workspace of [primary, other]) await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)')
 .bind(workspace.projectId, JSON.stringify(initial), 123).run()

const call = (body, { token = primary.tokens.owner, workspace = primary, method = 'PUT' } = {}) => app.request(
 `/api/management/projects/${workspace.projectId}/settings`, {
  raw: true, method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(method === 'PUT' ? { body: JSON.stringify(body) } : {}),
 })
// What the installed widget receives: the public settings route's brand.
const brand = async () => { const response = await app.request(`/api/widget/settings?widgetKey=${primary.widgetKey}`, { headers: { Origin: primary.allowedOrigin } }); assert.equal(response.status, 200); return (await response.json()).brand }
const snapshot = () => DB.prepare('SELECT p.*,s.settings_json,s.updated_at FROM projects p JOIN project_settings s ON s.project_id=p.id ORDER BY p.id').all().then(result => result.results)
const saved = async () => {
 const response = await call(undefined, { method: 'GET' })
 assert.equal(response.status, 200)
 return (await response.json()).data
}
const imageInvalid = [
 'javascript:alert(1)', 'data:image/png;base64,aGVsbG8=', 'ftp://images.example/logo.png', '//images.example/logo.png',
 'images.example/logo.png', 'https:images.example/logo.png', 'https:///images.example/logo.png', 'https://',
 'https://[invalid/logo.png', 'https://user:password@images.example/logo.png', 'https://@images.example/logo.png',
 '/\\images.example/logo.png', 'https://images.example/a\\b.png', 'https://images.example/a b.png',
 '\nhttps://images.example/logo.png', '/media/a\t.png', 'https://images.example/a\u0000.png', '/media/a\u007f.png',
 '/media/%zz.png', '/media/%0a.png', 'https://images.example/' + 'a'.repeat(2048),
 null, 42, false, [], {},
]
const colorInvalid = ['not-a-color', 'red', '#123', '#12345678', '#12345g', '123456', 'rgb(0,0,0)', '#123456;display:none', '\n#123456', '#123456\u0000', ' '.repeat(2001), null, 42, false, [], {}]
const textInvalid = [null, 42, 0, true, false, [], ['Supplied text'], {}, { text: 'Supplied text' }]

for (const [keys, values, explanation] of [
 [['logo_url', 'avatar_url', 'brand_image_url'], imageInvalid, /HTTP\(S\).*root-relative.*empty to reset/],
 [['primary_color', 'color'], colorInvalid, /six-digit hex color.*#RRGGBB.*empty to reset/],
 [['brand_name'], [...textInvalid, 'n'.repeat(301)], /text of at most 300 characters.*empty to reset/],
 [['welcome_message'], [...textInvalid, 'g'.repeat(1001)], /text of at most 1000 characters.*empty to reset/],
]) for (const key of keys) {
 const before = await snapshot(), appearance = (await brand())
 for (const value of values) {
  const response = await call({
   ...initial, name: 'Must not rename', allowed_origin: 'https://must-not-change.example',
   timezone: 'Australia/Brisbane', is_enabled: false, welcome_message: 'Must not change', [key]: value,
  })
  const message = await response.text()
  assert.equal(response.status, 400, `${key}=${JSON.stringify(value)}: ${message}`)
  assert.ok(message.includes(key), 'error identifies the invalid field')
  assert.match(message, explanation)
  assert.deepEqual(await snapshot(), before, 'row bytes, timestamps, project and both tenants stay unchanged')
  assert.deepEqual((await brand()), appearance, 'saved public appearance stays unchanged')
 }
}

// appearance text persists at projection limits without truncation, and retains Unicode and multiline greetings
{
 const otherBefore = (await snapshot()).find(row => row.id === other.projectId)
 for (const patch of [
  { brand_name: 'n'.repeat(300), welcome_message: 'g'.repeat(1000) },
  { brand_name: '支援チーム', welcome_message: 'Welcome!\nHow can we help?\nこんにちは。' },
 ]) {
  const response = await call(patch)
  assert.equal(response.status, 200, await response.clone().text())
  const reloaded = await saved(), appearance = (await brand())
  assert.equal(reloaded.brand_name, patch.brand_name)
  assert.equal(reloaded.welcome_message, patch.welcome_message)
  assert.equal(appearance.name, patch.brand_name)
  assert.equal(appearance.greeting, patch.welcome_message)
  assert.equal(reloaded.timezone, initial.timezone)
  assert.deepEqual(reloaded.retained_setting, initial.retained_setting)
  assert.deepEqual((await snapshot()).find(row => row.id === other.projectId), otherBefore)
 }
 assert.equal((await call({ brand_name: '  Support  ', welcome_message: '  Hello!\nHow can we help?  ' })).status, 200)
 assert.equal((await saved()).brand_name, 'Support')
 assert.equal((await saved()).welcome_message, 'Hello!\nHow can we help?')
 assert.equal((await call({ brand_name: '  ', welcome_message: '\n  ' })).status, 200)
 assert.equal((await saved()).brand_name, '')
 assert.equal((await saved()).welcome_message, '')
 assert.equal((await brand()).name, primary.name)
 assert.equal((await brand()).greeting, '')
}

// HTTP(S), root-relative images and six-digit colors persist through owner/admin routes and reload
{
 const otherBefore = (await snapshot()).find(row => row.id === other.projectId)
 for (const image of ['https://images.example/logo.svg?size=2&name=a%20b#mark', 'http://images.example/logo.png', '/media/brand%20image.svg?size=2', '/media/ブランド.svg']) {
  const patch = { logo_url: image, avatar_url: image, brand_image_url: image, primary_color: '#Aa00fF', color: '#000000' }
  const response = await call(patch, { token: primary.tokens.admin })
  assert.equal(response.status, 200, await response.clone().text())
  const reloaded = await saved()
  for (const [key, value] of Object.entries(patch)) assert.equal(reloaded[key], value)
  const appearance = (await brand())
  assert.equal(appearance.logo_url, image)
  assert.equal(appearance.avatar_url, image)
  assert.equal(appearance.brand_image_url, image)
  assert.equal(appearance.color, patch.primary_color)
  assert.equal(reloaded.timezone, initial.timezone)
  assert.deepEqual(reloaded.retained_setting, initial.retained_setting)
  assert.deepEqual((await snapshot()).find(row => row.id === other.projectId), otherBefore)
 }
 const response = await call({ logo_url: '  https://IMAGES.example/logo.png  ', primary_color: '  #fF00AA  ' })
 assert.equal(response.status, 200)
 assert.equal((await saved()).logo_url, 'https://images.example/logo.png')
 assert.equal((await saved()).primary_color, '#fF00AA')
}

// empty overrides reset and omitted fields preserve existing settings
{
 const patch = Object.fromEntries(['brand_name', 'welcome_message', 'logo_url', 'avatar_url', 'brand_image_url', 'primary_color', 'color'].map(key => [key, '']))
 assert.equal((await call(patch)).status, 200)
 const reloaded = await saved()
 for (const key of Object.keys(patch)) assert.equal(reloaded[key], '')
 assert.deepEqual((await brand()), { name: primary.name, greeting: '', logo_url: '', avatar_url: '', brand_image_url: '', color: '' })
 assert.equal(reloaded.timezone, initial.timezone)
 assert.deepEqual(reloaded.retained_setting, initial.retained_setting)
 // Existing legacy fields outside the supplied patch are not rewritten or newly rejected.
 await DB.prepare('UPDATE project_settings SET settings_json=json_set(settings_json,\'$.logo_url\',\'legacy-invalid\') WHERE project_id=?').bind(primary.projectId).run()
 assert.equal((await call({ timezone: 'Australia/Brisbane' })).status, 200)
 assert.equal((await saved()).logo_url, 'legacy-invalid')
 assert.equal((await brand()).logo_url, '')
 assert.equal((await call({ logo_url: '  ', color: '  ', primary_color: '  ' })).status, 200)
 assert.equal((await saved()).logo_url, '')
}

// validation preserves authentication, current role and tenant authority
{
 const before = await snapshot()
 for (const [token, status] of [['', 401], [primary.tokens.operator, 403], [other.tokens.owner, 403]]) {
  for (const logo_url of ['https://images.example/valid.png', 'javascript:alert(1)']) {
   assert.equal((await call({ logo_url }, { token })).status, status)
   assert.deepEqual(await snapshot(), before)
  }
 }
 await DB.prepare('DELETE FROM memberships WHERE project_id=? AND user_id=?').bind(primary.projectId, 'admin-appearance').run()
 assert.equal((await call({ primary_color: '#abcdef' }, { token: primary.tokens.admin })).status, 401, 'revoked membership invalidates the session')
 await DB.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').bind(Date.now(), sha(primary.tokens.owner)).run()
 assert.equal((await call({ primary_color: '#abcdef' })).status, 401)
 assert.deepEqual(await snapshot(), before)
}

// The public brand applies the same allowlist defensively to older stored invalid values.
{
 for (const value of imageInvalid) {
  await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.logo_url',json(?),'$.avatar_url',json(?),'$.brand_image_url',json(?)) WHERE project_id=?").bind(JSON.stringify(value), JSON.stringify(value), JSON.stringify(value), primary.projectId).run()
  const appearance = await brand()
  assert.equal(appearance.logo_url, ''); assert.equal(appearance.avatar_url, ''); assert.equal(appearance.brand_image_url, '')
 }
 for (const value of colorInvalid) { await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.primary_color',json(?)) WHERE project_id=?").bind(JSON.stringify(value), primary.projectId).run(); assert.equal((await brand()).color, '') }
}
}finally{await app.close()}
}
