import test from 'node:test'
import assert from 'node:assert/strict'
import { UAParser } from 'ua-parser-js'

// Conversation details render browser and OS names from the contact's user agent.
test('patched ua-parser-js keeps the browser and OS fields the conversation details show', () => {
 const chrome = new UAParser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36').getResult()
 assert.equal(chrome.browser.name, 'Chrome'); assert.equal(chrome.browser.version, '128.0.0.0')
 assert.equal(chrome.os.name, 'Mac OS'); assert.equal(chrome.os.version, '10.15.7')
 const iphone = new UAParser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1').getResult()
 assert.equal(iphone.browser.name, 'Mobile Safari'); assert.equal(iphone.os.name, 'iOS'); assert.equal(iphone.os.version, '17.5')
})

test('hostile user agents parse in bounded time', () => {
 // GHSA-fhg7-m89q-25r3: crafted strings caused catastrophic backtracking before 1.0.33.
 const hostile = ['Mozilla/5.0 (' + ' '.repeat(50000) + ')', 'Opera/9.80 (' + 'a'.repeat(50000) + '1', ';'.repeat(50000) + 'Trident/']
 const started = performance.now()
 for (const value of hostile) new UAParser(value).getResult()
 assert.ok(performance.now() - started < 2000)
})
