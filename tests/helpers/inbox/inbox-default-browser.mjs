import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRuntime} from '../emitted-runtime.mjs'
import {buildInboxFixture} from '../inbox-conversation-fixture.mjs'
import {launchBrowser} from '../../journeys/kit/browser.mjs'

export async function inboxDefault(){

const tempRoot=await mkdtemp(join(tmpdir(),'inbox-default-')),previousTmp=process.env.TMPDIR
process.env.TMPDIR=tempRoot

let runtime,browser,context,page,success=false
const errors=[]
try{
 runtime=await createRuntime()
 browser=await launchBrowser()
 context=await browser.newContext({viewport:{width:1440,height:900}})
 page=await context.newPage()
 page.setDefaultTimeout(15000)
 page.on('pageerror',error=>errors.push(error.message))
 const fx=await buildInboxFixture(runtime.origin)
 const inboxPath=`/projects/${fx.projectId}/conversations`
 const countsPath=`/api/dashboard/projects/${fx.projectId}/conversations/counts`
 const counts=await fx.api(countsPath)
 assert.equal(counts.data.mine,0,'the operator starts with no assigned conversations')
 assert.ok(counts.data.open>0,'the fixture contains open conversations')

 await page.goto(runtime.origin+'/login?'+new URLSearchParams({returnTo:inboxPath}))
 await page.getByLabel('Email',{exact:true}).fill(fx.owner.email)
 await page.getByLabel('Password',{exact:true}).fill(fx.owner.password)
 await page.getByRole('button',{name:'Login',exact:true}).click()
 await page.waitForURL(url=>url.pathname===inboxPath&&!url.search)

 const waitForView=view=>page.waitForFunction(expected=>{
  const current=document.querySelectorAll('nav[data-testid="inbox-views"] a[aria-current="page"]')
  return current.length===1&&new URL(current[0].href).searchParams.get('view')===expected},view)
 const rows=page.locator('.conversation-list-items .conversation-item')
 const checkOpenRows=async()=>{
  await page.getByText('Rate 100% Rhea',{exact:true}).waitFor()
  assert.ok(await rows.count()>0,'All open shows real unassigned conversations')
  assert.equal(await page.getByText('Hannah Closed',{exact:true}).count(),0,'All open excludes the closed conversation')
 }

 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900})
  await page.goto(runtime.origin+inboxPath)
  await waitForView('open')
  await checkOpenRows()
  assert.equal(new URL(page.url()).searchParams.has('view'),false,`${width}px keeps the default implicit`)

  await page.goto(runtime.origin+inboxPath+'?view=mine')
  await waitForView('mine')
  await page.getByText('No conversations match this view.',{exact:true}).waitFor()
  assert.equal(await rows.count(),0,`${width}px preserves an explicit Your inbox choice with zero assignments`)
 }

 const bootstrap=await fx.api(`/api/management/bootstrap?projectId=${fx.projectId}`)
 assert.ok(bootstrap.currentAgent?.id,'the real workspace bootstrap identifies the operator')
 await fx.api(`/api/dashboard/projects/${fx.projectId}/conversations/${fx.contacts.alpha.id}`,{
  method:'PUT',body:{agent_id:bootstrap.currentAgent.id},
 })
 const assignedCounts=await fx.api(countsPath)
 assert.equal(assignedCounts.data.mine,1,'assignment appears in the real operator count')

 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900})
  await page.goto(runtime.origin+inboxPath)
  await waitForView('mine')
  await page.getByText('Row Alpha',{exact:true}).waitFor()
  assert.equal(await rows.count(),1,`${width}px defaults to the operator's one assigned conversation`)
  assert.equal(await page.getByText('Row Beta',{exact:true}).count(),0,`${width}px Your inbox applies its real assignment filter`)

  await page.goto(runtime.origin+inboxPath+'?view=open')
  await waitForView('open')
  await page.getByText('Row Alpha',{exact:true}).waitFor()
  await page.getByText('Row Beta',{exact:true}).waitFor()
  assert.ok(await rows.count()>1,`${width}px preserves explicit All open and includes unassigned conversations`)
 }

 assert.deepEqual(errors,[],'the inbox has no browser exceptions')
 success=true
}finally{
if(previousTmp===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=previousTmp
 await context?.close()
 await browser?.close()
 await runtime?.close(success)
 if(success)await rm(tempRoot,{recursive:true,force:true})
}
console.log('Inbox default browser checks passed at 1440px and 390px.')

}
