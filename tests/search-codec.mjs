import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSearch,stringifySearch} from '../src/search-codec.ts'

test('text that reads as a number is kept exactly as written', () => {
 for (const value of ['1e3','1E5','12E4567890','1.0','-0','007','12345678901234567890','0x1f']) {
  const parsed = parseSearch('?state=' + encodeURIComponent(value))
  assert.equal(parsed.state, value, value)
  assert.equal(stringifySearch(parsed), '?state=' + encodeURIComponent(value), value)
 }
})

test('canonical numbers and booleans round-trip and structured values stay structured', () => {
 const parsed = parseSearch('?page=2&open=true&targets=%5B%22projects%2Fp%2Farticles%2Fa%22%5D&q=hello%20world&redirect_uri=https%3A%2F%2Fx.test%2Fcb')
 assert.deepEqual({...parsed}, {page: 2, open: true, targets: ['projects/p/articles/a'], q: 'hello world', redirect_uri: 'https://x.test/cb'})
 assert.deepEqual({...parseSearch(stringifySearch(parsed))}, {...parsed})
})

test('a string that looks like JSON is quoted so it comes back as the same string', () => {
 const value = '{"a":1}'
 assert.equal(parseSearch(stringifySearch({targets: value})).targets, value)
})
