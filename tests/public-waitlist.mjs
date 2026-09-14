import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)}})
const {Hono}=await import('hono'),{getPlatformProxy}=await import('wrangler'),{waitlistRoutes,waitlistForm}=await import('../src/modules/public-site/waitlist.ts'),proxy=await getPlatformProxy({persist:false}),originalFetch=globalThis.fetch
try{
 for(const file of ['0001_identity.sql','0080_integrations.sql','0095_public_site.sql'])for(const sql of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(s=>s.trim()))await proxy.env.DB.prepare(sql).run()
 const app=new Hono();app.get('/waitlist',c=>waitlistForm(c,readFileSync(new URL('../src/modules/public-site/pages/waitlist-create.html',import.meta.url),'utf8')));app.route('/',waitlistRoutes)
 const env={...proxy.env,EMAIL_API_KEY:undefined,EMAIL_FROM:undefined,WAITLIST_NOTIFY_EMAIL:undefined},response=await app.request('http://localhost/waitlist',{},env),cookie=response.headers.get('set-cookie').split(';')[0],html=await response.text(),token=html.match(/name="_token" value="([^"]+)"/)[1]
 const submit=(entry,extra={})=>app.request('http://localhost/waitlist',{method:'POST',headers:{cookie,origin:'http://localhost','content-type':'application/x-www-form-urlencoded',...extra},body:new URLSearchParams(entry)},env)
 const entry={_token:token,name:'Synthetic Test',email:'test@example.invalid',url:'https://example.invalid'}
 assert.equal((await submit({...entry,_token:'invalid'})).status,403);assert.equal((await submit(entry,{origin:'https://hostile.invalid'})).status,403);assert.equal((await submit({...entry,url:'javascript:alert(1)'})).status,422)
 assert.equal((await submit(entry)).status,201);assert.equal((await submit(entry)).status,409)
 assert.equal((await env.DB.prepare('SELECT notification_status FROM public_waitlist').first()).notification_status,'not_configured')
 env.EMAIL_API_KEY='test-fixture';env.EMAIL_FROM='test@example.invalid';env.WAITLIST_NOTIFY_EMAIL='owner@example.invalid';let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({id:'fixture-delivery'}))}
 assert.equal((await submit({...entry,email:'notify@example.invalid'})).status,201);assert.equal(calls,1);assert.equal((await env.DB.prepare("SELECT notification_status FROM public_waitlist WHERE email='notify@example.invalid'").first()).notification_status,'sent')
 globalThis.fetch=async()=>{calls++;throw new Error('ambiguous fixture')};assert.equal((await submit({...entry,email:'uncertain@example.invalid'})).status,201);assert.equal((await submit({...entry,email:'uncertain@example.invalid'})).status,409);assert.equal(calls,2);assert.equal((await env.DB.prepare("SELECT notification_status FROM public_waitlist WHERE email='uncertain@example.invalid'").first()).notification_status,'uncertain')
 console.log('Real D1 waitlist: admission, validation, CSRF, duplicate, configured notification and ambiguous no-replay passed; provider fixtures only')
}finally{globalThis.fetch=originalFetch;await proxy.dispose()}
