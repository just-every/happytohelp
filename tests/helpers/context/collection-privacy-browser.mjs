import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {createRuntime} from '../emitted-runtime.mjs'
import {launchBrowser} from '../../journeys/kit/browser.mjs'

// What the widget collects from a real host page, read from the requests it actually sends: after the visitor
// consents, ordinary activity is described, but elements the site marks context-exclude, password values and
// personal data typed into fields never leave the page; once the visitor stops sharing, nothing more is collected.
export async function collectionPrivacyBrowser(){
 const runtime=await createRuntime({queueConsumers:true,inspectorPort:0,vars:{OPENAI_API_KEY:'synthetic-inert-test-key'},outboundFixture:new URL('../proactive-provider-network.mjs',import.meta.url).href})
 let browser,host,success=false
 const call=async(path,body,token,method=body===undefined?'GET':'POST')=>{const response=await fetch(runtime.origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(response.ok,`${path}: ${response.status} ${await response.clone().text()}`);return response.json()}
 const secrets=['Secret plan 7Q9X','4111 1111 1111 1111','visitor.secret@example.test','hunter2-correct-horse','555-123-4567']
 try{
  const owner=await call('/api/identity/bootstrap',{name:'Privacy Support',email:'privacy-owner@example.test',password:'synthetic-privacy-owner-password',allowedOrigin:runtime.origin})
  const project=await call('/api/identity/projects/'+owner.projectId,undefined,owner.token)
  await call(`/api/management/projects/${owner.projectId}/settings`,{is_contact_tracking_enabled:true,proactive_help_enabled:true},owner.token,'PUT')
  const widget=await readFile(new URL('../../../public/widget.js',import.meta.url))
  host=createServer((request,response)=>{
   response.setHeader('Content-Type',request.url==='/widget.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8')
   response.end(request.url==='/widget.js'?widget:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account settings</title><main><h1>Account settings</h1><button id="billing">Open billing help</button><div class="context-exclude"><button id="secret">Secret plan 7Q9X</button><p>Card 4111 1111 1111 1111</p></div><form onsubmit="return false"><label>Contact email <input id="email" type="text" name="email"></label><label>Password <input id="password" type="password" name="password"></label><button id="save">Save details</button></form><p>Call us at 555-123-4567</p></main><script src="/widget.js"></script><script>h2h('init',${JSON.stringify({widgetKey:project.widget_key,apiOrigin:runtime.origin,open:true})})</script>`)
  })
  await new Promise(done=>host.listen(0,'127.0.0.1',done))
  const hostOrigin=`http://127.0.0.1:${host.address().port}`
  await call(`/api/management/projects/${owner.projectId}/settings`,{allowed_origin:hostOrigin},owner.token,'PUT')
  browser=await launchBrowser()
  for(const [width,height] of [[1440,960],[390,844]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:width===390,hasTouch:width===390}),page=await context.newPage(),sent=[],errors=[]
   page.on('pageerror',error=>errors.push(error.message))
   // The collector's real requests, as the network sees them.
   page.on('request',request=>{if(request.url().endsWith('/widget-events')){const body=request.postDataJSON();if(body?.action==='collector'||body?.action==='pingAction')sent.push({at:Date.now(),action:body.action,text:JSON.stringify(body.data)})}})
   const collected=()=>sent.filter(entry=>entry.action==='collector').map(entry=>entry.text).join('\n')
   try{
    await page.goto(hostOrigin)
    // Nothing is collected before consent.
    await page.getByRole('button',{name:'Allow proactive help',exact:true}).waitFor()
    await page.getByRole('button',{name:'Close chat',exact:true}).click()
    await page.locator('#billing').click();await page.waitForTimeout(1500);assert.equal(collected(),'','no activity leaves the page before consent')
    await page.getByRole('button',{name:'Open chat'}).first().click()
    await page.getByRole('button',{name:'Allow proactive help',exact:true}).click()
    await page.getByRole('button',{name:'Stop sharing activity'}).waitFor()
    await page.getByRole('button',{name:'Close chat',exact:true}).click()
    await page.locator('#billing').click()
    await page.locator('#secret').click()
    await page.locator('#email').fill('visitor.secret@example.test')
    await page.locator('#password').fill('hunter2-correct-horse')
    await page.locator('#save').click()
    const deadline=Date.now()+30000
    while(!/Open billing help/.test(collected())&&Date.now()<deadline)await page.waitForTimeout(250)
    assert.match(collected(),/Open billing help/,'ordinary activity is collected after consent')
    await page.waitForTimeout(3000)
    for(const secret of secrets)assert.ok(!collected().includes(secret),`${secret} never leaves the page: ${collected().slice(0,400)}`)
    // Stopping sharing ends collection: further activity sends nothing.
    await page.getByRole('button',{name:'Open chat'}).first().click()
    await page.getByRole('button',{name:'Stop sharing activity'}).click()
    await page.getByRole('button',{name:'Allow proactive help',exact:true}).waitFor()
    await page.getByRole('button',{name:'Close chat',exact:true}).click()
    await page.waitForTimeout(1500);const stoppedAt=Date.now()
    for(let index=0;index<3;index++)await page.locator('#billing').click()
    await page.locator('#email').fill('after-revocation@example.test')
    await page.waitForTimeout(6000)
    assert.deepEqual(sent.filter(entry=>entry.at>=stoppedAt),[],'no collector or activity request after the visitor stops sharing')
    assert.deepEqual(errors,[])
   }finally{await context.close()}
  }
  // The stored evidence holds none of it either.
  const stored=await runtime.execute('SELECT action FROM context_actions;')
  for(const secret of secrets)assert.ok(!stored.includes(secret),`${secret} is not stored`)
  success=true
 }finally{await browser?.close();if(host)await new Promise(done=>host.close(done));await runtime.close(success)}
}
