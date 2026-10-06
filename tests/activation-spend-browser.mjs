// Focused component browser proof using the real route, identity and local D1.
// The task's integrated activation suite separately verifies shell mounting.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createSpendHarness } from './activation-spend.mjs'
const require = createRequire(import.meta.url)
const { build } = require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]}))
const temporary = await mkdtemp(join(tmpdir(),'h2h-spend-component-'))
const evidence = process.env.H2H_EVIDENCE_DIR ? resolve(process.env.H2H_EVIDENCE_DIR) : join(temporary,'captures')
await mkdir(evidence,{recursive:true})
const harness = await createSpendHarness()
let server, browser
try {
 const origin='http://127.0.0.1:16042'
 const setup = await harness.call('/api/identity/bootstrap',{name:'Spend browser',email:'spend-browser@example.test',password:'local-spend-browser-password',allowedOrigin:origin})
 assert.equal(setup.status,201)
 const owner=await setup.json(), db=harness.db
 const component = `import React from 'react'; import {createRoot} from 'react-dom/client'; import AiSpendCard from './src/ui/native/activation-spend/AiSpendCard'; createRoot(document.getElementById('root')).render(<AiSpendCard projectId={${JSON.stringify(owner.projectId)}}/>);`
 await build({stdin:{contents:component,resolveDir:process.cwd(),loader:'jsx'},bundle:true,outfile:join(temporary,'card.js'),format:'esm',platform:'browser',logLevel:'silent'})
 const js=await readFile(join(temporary,'card.js')),css=await readFile(join(temporary,'card.css'))
 server=createServer(async(req,res)=>{
  try {
   if(req.url.startsWith('/api/')) {
    const response=await harness.mf.dispatchFetch(origin+req.url,{headers:req.headers})
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return
   }
   if(req.url==='/card.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(js);return}
   if(req.url==='/card.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(css);return}
   res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/card.css"><style>body{font-family:Arial,sans-serif;margin:16px}main{max-width:840px;margin:auto}button{cursor:pointer}</style><title>AI spend component test</title></head><body><main id="root"></main><script type="module" src="/card.js"></script></body></html>')
  }catch(error){res.writeHead(500);res.end(String(error))}
 })
 await new Promise(resolve=>server.listen(16042,'127.0.0.1',resolve))
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext()
 await context.addCookies([{name:'h2h_session',value:owner.token,url:origin}])
 const page=await context.newPage(), errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 const refresh=async text=>{await page.getByRole('button',{name:'Refresh spend'}).click();await page.getByText(text,{exact:true}).waitFor()}
 const seed=async(cost)=>{
  const now=new Date().toISOString()
  await db.prepare("INSERT INTO ai_generations(id,project_id,conversation_id,state,source_revision,actor_json,model,ai_id,ai_profile_json,created_at,updated_at) VALUES('browser-generation',?,'conversation','completed',0,'{\"role\":\"operator\"}','model','ai','{}',?,?)").bind(owner.projectId,now,now).run()
  await db.prepare("INSERT INTO ai_attempts(id,generation_id,state,started_at) VALUES('browser-attempt','browser-generation','completed',?)").bind(now).run()
  await db.prepare("INSERT INTO ai_round_usage(attempt_id,request_id,usage_json,observed) VALUES('browser-attempt','browser-request',?,1)").bind(JSON.stringify({cost,metadata:{source:'xai',provider_cost_ticks:cost*1e10}})).run()
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:980})
  await page.goto(origin)
  await page.getByText('No recorded spend',{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:join(evidence,`empty-${width}.jpg`),fullPage:true})
 }
 await seed(0)
 await refresh('$0.00')
 await db.prepare("UPDATE ai_round_usage SET usage_json=? WHERE attempt_id='browser-attempt'").bind(JSON.stringify({cost:null})).run()
 await refresh('Unknown')
 await db.prepare("INSERT INTO ai_round_usage(attempt_id,request_id,usage_json,observed) VALUES('browser-attempt','second-request','{\"cost\":0.025,\"metadata\":{\"source\":\"xai\",\"provider_cost_ticks\":250000000}}',1)").run()
 await refresh('$0.025 reported')
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:980})
  assert.equal(await page.getByText('Partial cost: the total is unknown.',{exact:true}).count(),1)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:join(evidence,`partial-${width}.jpg`),fullPage:true})
  await page.getByRole('button',{name:'Refresh spend'}).focus()
  assert.equal(await page.getByRole('button',{name:'Refresh spend'}).evaluate(el=>el===document.activeElement),true)
 }
 await db.prepare("UPDATE ai_round_usage SET usage_json='{\"cost\":0}' WHERE attempt_id='browser-attempt'").run()
 await refresh('Unknown')
 await page.getByText(/Estimated recorded cost \(USD\): \$0.00/).waitFor()
 await db.prepare('DELETE FROM memberships WHERE project_id=?').bind(owner.projectId).run()
 await page.getByRole('button',{name:'Refresh spend'}).click()
 await page.getByRole('alert').waitFor()
 assert.match(await page.getByRole('alert').innerText(),/Could not load AI spend/)
 assert.equal(await page.getByText('$0.025 reported',{exact:true}).count(),0)
 assert.equal(harness.outbound(),0);assert.deepEqual(errors,[])
 const receipt={scope:'component with real route and local D1; shell mounting requires integrated activation suite',widths:[1440,390],states:['empty','known-zero','unknown','partial','estimated-zero-actual-unknown','revoked-membership-error'],outboundCalls:harness.outbound(),screenshots:evidence}
 await writeFile(join(evidence,'receipt.json'),JSON.stringify(receipt,null,2))
 console.log(JSON.stringify(receipt))
} finally {
 await browser?.close()
 if(server)await new Promise(resolve=>server.close(resolve))
 await harness.mf.dispose()
 if(process.env.H2H_EVIDENCE_DIR)await rm(temporary,{recursive:true,force:true})
 else console.log('Retained component screenshots:',evidence)
}
