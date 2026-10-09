import test from 'node:test'
import assert from 'node:assert/strict'
import { headerSurface, withSecurityHeaders } from '../src/platform/security-headers.ts'

const html = (headers = {}) => new Response('<!doctype html><p>page</p>', {status: 200, headers: {'Content-Type': 'text/html; charset=utf-8', ...headers}})

test('application responses allow only same-origin framing by default', async () => {
 const response = withSecurityHeaders(html({'Cache-Control': 'no-store'}), 'application', {})
 assert.equal(response.status, 200)
 assert.equal(response.headers.get('Content-Security-Policy'), "frame-ancestors 'self'")
 assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN')
 assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
 assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
 assert.equal(response.headers.get('Cache-Control'), 'no-store')
 assert.equal(await response.text(), '<!doctype html><p>page</p>')
})

test('a configured RER management origin may frame the app without a conflicting X-Frame-Options', () => {
 const response = withSecurityHeaders(html({'X-Frame-Options': 'DENY'}), 'application', {RER_MANAGEMENT_ORIGIN: 'https://manage.example.test'})
 assert.equal(response.headers.get('Content-Security-Policy'), "frame-ancestors 'self' https://manage.example.test")
 assert.equal(response.headers.get('X-Frame-Options'), null)
})

test('an existing response policy gains frame-ancestors instead of being replaced', () => {
 const existing = withSecurityHeaders(html({'Content-Security-Policy': "default-src 'self'"}), 'application', {})
 assert.equal(existing.headers.get('Content-Security-Policy'), "default-src 'self'; frame-ancestors 'self'")
 const explicit = withSecurityHeaders(html({'Content-Security-Policy': "frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer'}), 'application', {})
 assert.equal(explicit.headers.get('Content-Security-Policy'), "frame-ancestors 'none'")
 assert.equal(explicit.headers.get('Referrer-Policy'), 'no-referrer')
})

test('a response that denies all framing in both CSP and X-Frame-Options keeps both', () => {
 const denied = withSecurityHeaders(html({'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY'}), 'application', {RER_MANAGEMENT_ORIGIN: 'https://manage.example.test'})
 assert.equal(denied.headers.get('Content-Security-Policy'), "default-src 'self'; frame-ancestors 'none'")
 assert.equal(denied.headers.get('X-Frame-Options'), 'DENY')
})

test('published Help Center pages stay embeddable on customer sites', () => {
 const response = withSecurityHeaders(html(), 'embeddable', {})
 assert.equal(response.headers.get('Content-Security-Policy'), null)
 assert.equal(response.headers.get('X-Frame-Options'), null)
 assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
 assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
})

test('website preview responses keep their own sandbox and framing policy', () => {
 const policy = 'sandbox allow-scripts allow-same-origin; frame-ancestors https://app.example.test'
 const original = html({'Content-Security-Policy': policy, 'Referrer-Policy': 'no-referrer'})
 const response = withSecurityHeaders(original, 'preview', {})
 assert.equal(response, original)
 assert.equal(response.headers.get('Content-Security-Policy'), policy)
 assert.equal(response.headers.get('X-Frame-Options'), null)
})

test('WebSocket upgrades are returned untouched', () => {
 const upgrade = {status: 101, headers: new Headers(), webSocket: {}}
 assert.equal(withSecurityHeaders(upgrade, 'application', {}), upgrade)
})

test('immutable upstream headers are copied rather than mutated', () => {
 const upstream = Response.redirect('https://app.example.test/login', 302)
 assert.throws(() => upstream.headers.set('X-Test', '1'))
 const response = withSecurityHeaders(upstream, 'application', {})
 assert.equal(response.status, 302)
 assert.equal(response.headers.get('Location'), 'https://app.example.test/login')
 assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN')
})

test('route surfaces: app documents and APIs are application; Help Center is embeddable; preview is its own', () => {
 for (const path of ['/', '/login', '/setup', '/projects', '/api/identity/session', '/api/widget/settings', '/health']) assert.equal(headerSurface(path, false), 'application', path)
 for (const path of ['/help/acme', '/help/acme/article', '/acme', '/acme/search']) assert.equal(headerSurface(path, true), 'embeddable', path)
 assert.equal(headerSurface('/api/public-site/projects/p/alias', true), 'application')
 assert.equal(headerSurface('/preview/project/token/', false), 'preview')
})
