import assert from 'node:assert/strict'
const origin=process.env.H2H_TEST_ORIGIN
if(!origin)throw Error('Set H2H_TEST_ORIGIN to the real local native Worker with migrations applied')
for(const path of ['/','/features/sales','/features/support','/features/optimization','/pricing','/resources/install','/resources/widget-hash','/resources/javascript-api','/resources/javascript-options','/resources/values','/resources/safety','/resources/future','/company/terms','/company/privacy','/company/cookies','/waitlist']){
 const response=await fetch(origin+path);assert.equal(response.status,200,path);const html=await response.text();assert.match(html,/<!doctype html>/i);assert.doesNotMatch(html,/Font Awesome Pro|<\?php|@extends\(/);for(const asset of html.matchAll(/(?:src|href)="(\/site-assets\/[^"?]+)/g)){const response=await fetch(origin+asset[1]);assert.equal(response.status,200,asset[1])}
}
assert.equal((await fetch(origin+'/demo?website=https://example.com')).status,503)
const form=await fetch(origin+'/waitlist'),cookie=form.headers.get('set-cookie').split(';')[0],html=await form.text(),token=html.match(/name="_token" value="([^"]+)"/)[1]
const submit=body=>fetch(origin+'/waitlist',{method:'POST',headers:{cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)})
const entry={_token:token,name:'Public runtime test',email:`native-public-${Date.now()}@example.invalid`,url:'https://example.invalid'}
assert.equal((await submit({...entry,_token:'wrong'})).status,403)
assert.equal((await submit({...entry,url:'javascript:alert(1)'})).status,422)
assert.equal((await submit(entry)).status,201)
assert.equal((await submit(entry)).status,409)
if(process.env.H2H_TEST_PROJECT_ID){const project=process.env.H2H_TEST_PROJECT_ID;for(const path of [`/${project}`,`/${project}/search`,`/${project}/search?keyword=test`,`/help/${project}`])assert.equal((await fetch(origin+path)).status,200,path);assert.equal((await fetch(`${origin}/${project}/never-published-${Date.now()}`)).status,404)}
console.log('Public source runtime: 16 pages/assets, real waitlist admission/CSRF/validation/duplicate persistence, explicit demo availability passed')
