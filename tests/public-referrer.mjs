import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {analyzeTrafficSource,generateVisitorMessages,personalizeHome}=await import('../src/modules/public-site/referrer.ts')
const cases=JSON.parse(readFileSync(new URL('./public-referrer-cases.json',import.meta.url)))
for(const sample of cases)assert.deepEqual(analyzeTrafficSource(sample.params,sample.referrer),sample.expected,JSON.stringify(sample.params)+sample.referrer)
const source=analyzeTrafficSource({utm_source:'google',utm_medium:'cpc',q:'best ecommerce platform'})
const messages=generateVisitorMessages(source,{query:'best ecommerce platform'},()=>0)
assert.equal(messages[0],'Clicked on Google Ad');assert.equal(messages[1],'Searched for: best ecommerce platform');assert.equal(messages.length,10)
const html=personalizeHome('<h2>We help maximise the potential of your website.</h2><script>window.visitorMessages = [];</script>',new Request('https://example.invalid/?utm_source=%3Cscript%3Ealert(1)%3C/script%3E'))
assert.doesNotMatch(html,/<script>alert/);assert.match(html,/&lt;script&gt;/)
console.log(`Referrer source equality: ${cases.length} original PHP source cases, priority and injection safety passed`)
