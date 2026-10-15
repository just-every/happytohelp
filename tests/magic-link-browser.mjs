import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import {createRuntime} from './helpers/emitted-runtime.mjs';
const output=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/magic-link');await mkdir(output,{recursive:true});
// Email itself is independently exercised at the SendGrid boundary by magic-link.mjs.
// This emitted-Worker browser suite uses unknown-email requests (no network email),
// and test-created capabilities for explicit user admission, expiration and replay.
const runtime=await createRuntime({vars:{APP_ORIGIN:'http://127.0.0.1',EMAIL_PROVIDER:'sendgrid',EMAIL_API_KEY:'test-never-sent',EMAIL_FROM:'support@example.test'}});
let browser,success=false;const receipts=[];
try{
 const tenant=await runtime.seedTenant({name:'Magic browser',email:'owner@magic-browser.test',allowedOrigin:runtime.origin});
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),posts=[];page.setDefaultTimeout(15000);
  page.on('request',request=>{if(request.method()==='POST')posts.push(new URL(request.url()).pathname)});
  await page.goto(runtime.origin+'/login');await page.getByRole('link',{name:'Email me a sign-in link'}).click();await page.getByLabel('Email',{exact:true}).fill(`unknown-${viewport.width}@magic-browser.test`);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/identity/magic-link')&&r.request().method()==='POST');await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).click();assert.equal((await response).status(),202);await page.getByRole('status').filter({hasText:'If this address belongs to a HappyToHelp account'}).waitFor();
  await page.screenshot({path:join(output,viewport.width+'-request.png'),fullPage:true});
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  await runtime.execute(`INSERT INTO magic_signins VALUES('${hash}','${tenant.userId}','${tenant.projectId}','owner@magic-browser.test',${Date.now()+60000},NULL)`);
  const link=runtime.origin+'/login/magic#token='+token;
  const scanner=await context.request.get(link);assert.equal(scanner.status(),200);assert.equal((await context.request.get(runtime.origin+'/api/identity/session')).status(),401);
  const before=posts.length;await page.goto(link);await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();await page.waitForFunction(()=>location.hash==='');assert.equal(posts.length,before,'Opening link does not consume it');assert.equal((await context.request.get(runtime.origin+'/api/identity/session')).status(),401);
  await page.screenshot({path:join(output,viewport.width+'-explicit-sign-in.png'),fullPage:true});await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname===`/projects/${tenant.projectId}/activation`);
  const session=await context.request.get(runtime.origin+'/api/identity/session');assert.equal(session.status(),200);assert.equal((await session.json()).id,tenant.userId);const cookie=(await context.cookies()).find(c=>c.name==='h2h_session');assert.ok(cookie.httpOnly);assert.equal(cookie.sameSite,'Lax');
  assert.equal(posts.filter(p=>p==='/api/identity/magic-link/consume').length,1);await page.screenshot({path:join(output,viewport.width+'-signed-in.png'),fullPage:true});
  const replay=await browser.newContext({viewport}),replayPage=await replay.newPage();await replayPage.goto(link);await replayPage.getByRole('button',{name:'Sign in',exact:true}).click();await replayPage.getByRole('alert').filter({hasText:'invalid, expired or already used'}).waitFor();assert.equal((await replay.request.get(runtime.origin+'/api/identity/session')).status(),401);await replayPage.screenshot({path:join(output,viewport.width+'-replay-denied.png'),fullPage:true});
  receipts.push({viewport,requestStatus:202,noGetConsumption:true,explicitConsumePosts:1,actorId:tenant.userId,httpOnly:cookie.httpOnly,sameSite:cookie.sameSite,replayDenied:true});await replay.close();await context.close();
 }
 await writeFile(join(output,'proof.json'),JSON.stringify(receipts,null,2));success=true;console.log('Magic browser PASS: request, neutral receipt, fragment removed, scanner-safe GET, explicit POST, session, replay denial at 1440x900 and 390x844.');
}finally{await browser?.close();await runtime.close(success)}
