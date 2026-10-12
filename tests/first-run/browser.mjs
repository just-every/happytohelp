import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import {createRuntime} from '../helpers/emitted-runtime.mjs';
import {audit,freePort,post} from './browser-kit.mjs';
import {setupJourney} from './setup-browser.mjs';
import {widgetJourney} from './widget-browser.mjs';
import {captureCustomerReply} from './customer-mail.mjs';
const evidence=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/first-run');await mkdir(evidence,{recursive:true});
const receipts=[];const browser=await chromium.launch({headless:true});let runtime;
try{
 for(const width of [1440,390]){
  const port=await freePort(),origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('base64url'),email=`local-${width}@example.test`;
  runtime=await createRuntime({port,inspectorPort:0,vars:{H2H_LOCAL:'true',APP_ORIGIN:origin,EMAIL_PROVIDER:'development',EMAIL_FROM:'support@localhost.test'}});
  const owner=await setupJourney({browser,runtime,width,evidence,password,email});
  receipts.push(await widgetJourney({browser,runtime,...owner,width,evidence,mailMode:'local'}));
  await captureCustomerReply(runtime,owner);
  const context=await browser.newContext({viewport:{width,height:844},bypassCSP:true}),page=await context.newPage();
  try{
   await page.goto(origin+'/login/magic');await page.getByRole('button',{name:'Create local sign-in link'}).waitFor();
   await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Create local sign-in link'}).click();
   await page.getByRole('status').filter({hasText:'local outbox'}).waitFor();await audit(page,evidence,`${width}-local-sign-in-request`);
   await page.getByRole('link',{name:'Open local outbox'}).click();await page.getByRole('link',{name:'Read message'}).first().waitFor();
   const detailPath=await page.getByRole('link',{name:'Read message'}).first().getAttribute('href');
   await runtime.restart();await page.reload();await page.getByRole('link',{name:'Read message'}).first().waitFor();
   assert.equal(await page.getByText('Reply to your support conversation',{exact:true}).count(),1,'one customer capture survives restart and duplicate Send');
   await page.goto(origin+detailPath);await page.getByRole('link',{name:'Open this link'}).waitFor();
   await audit(page,evidence,`${width}-retained-outbox`,{mask:[page.locator('pre')]});
   const link=await page.getByRole('link',{name:'Open this link'}).getAttribute('href');
   assert.equal((await context.request.get(link)).status(),200);
   assert.equal((await context.request.get(origin+'/api/identity/session')).status(),401);
   await page.getByRole('link',{name:'Open this link'}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>location.hash),'');assert.equal((await context.request.get(origin+'/api/identity/session')).status(),401);
   await audit(page,evidence,`${width}-confirm-local-sign-in`);await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await page.waitForURL(url=>url.pathname!=='/login/magic');assert.equal((await context.request.get(origin+'/api/identity/session')).status(),200);
   await audit(page,evidence,`${width}-local-authenticated`);
   receipts.push({width,nativeLocalSignIn:true,restartRetainedCapture:true,explicitConfirmation:true,axeSeriousCritical:0});
  }finally{await context.close();}
  await runtime.close(true);runtime=null;
 }
 for(const mode of ['unavailable','remote']){
  const port=await freePort(),origin=`http://127.0.0.1:${port}`;
  runtime=await createRuntime({port,inspectorPort:0,vars:{APP_ORIGIN:origin,...(mode==='remote'?{EMAIL_PROVIDER:'sendgrid',EMAIL_API_KEY:randomBytes(24).toString('hex'),EMAIL_FROM:'support@example.test'}:{})}});
  const password=randomBytes(24).toString('base64url'),owner=await post(origin,'/api/identity/bootstrap',{name:'Provider workspace',ownerName:'Provider owner',email:'owner@example.test',password,allowedOrigin:origin});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:844},bypassCSP:true}),page=await context.newPage();
   try{
    await page.goto(origin+'/login/magic');
    if(mode==='unavailable'){
     await page.getByText('Email sign-in needs a configured mail provider. Use your password to sign in.',{exact:true}).waitFor();
     assert.equal(await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).count(),0);
     assert.equal(await page.locator('form').count(),0);
    }else await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).waitFor();
    await audit(page,evidence,`${width}-${mode}-magic`);
    for(const method of ['GET','HEAD']){
     const response=await context.request.fetch(origin+'/__dev/outbox',{method,headers:{Origin:'http://127.0.0.1:8787',Forwarded:'host=localhost;proto=http','X-Forwarded-Host':'localhost','X-Forwarded-Proto':'http'}});
     assert.equal(response.status(),404);
    }
   }finally{await context.close();}
   receipts.push(await widgetJourney({browser,runtime,projectId:owner.projectId,token:owner.token,width,evidence,mailMode:mode}));
  }
  await runtime.close(true);runtime=null;
 }
 await writeFile(join(evidence,'proof.json'),JSON.stringify({receipts,axeSeriousCritical:0,horizontalOverflow:false},null,2));
 console.log('First-run browser journeys passed: setup, empty actions, snippet, workspace headers, local sign-in/restart, provider gating and widget geometry.');
}finally{await browser.close();if(runtime)await runtime.close(false);}
