import assert from 'node:assert/strict';
import {audit} from './browser-kit.mjs';
export async function beforeHydration({browser,origin,email,password}){
 const context=await browser.newContext({javaScriptEnabled:false}),page=await context.newPage();
 try{
  const forged=await context.request.post(origin+'/login',{headers:{Origin:'https://foreign.example'},form:{email,password},maxRedirects:0});assert.equal(forged.status(),403);
  assert.equal((await context.request.get(origin+'/api/identity/session')).status(),401);
  const wrong=await context.request.post(origin+'/login',{headers:{Origin:origin},form:{email,password:'test-only-wrong-owner-password'},maxRedirects:0});assert.equal(wrong.status(),401);
  const oversized=await context.request.post(origin+'/login',{headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},data:'email='+('x'.repeat(20000)),maxRedirects:0});assert.equal(oversized.status(),413);
  assert.equal((await context.request.get(origin+'/api/identity/session')).status(),401);
  await page.goto(origin+'/login?returnTo=%2Fprojects%3Fonboarding%3Dsetup');
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL(url=>url.pathname==='/projects');
  assert.equal((await context.request.get(origin+'/api/identity/session')).status(),200,'native password POST works with JavaScript disabled');
 }finally{await context.close();}
}
export async function signIn({browser,origin,openUrl,width,evidence}){
 const context=await browser.newContext({viewport:{width,height:844},bypassCSP:true}),page=await context.newPage();
 try{
  await page.goto(openUrl.trim());
  await page.getByTestId('setup-list').waitFor();
  assert.equal(await page.evaluate(()=>location.hash),'');
  const session=await context.request.get(origin+'/api/identity/session');assert.equal(session.status(),200);
  assert.equal((await session.json()).role,'owner');
  const native=(await context.cookies(origin)).find(cookie=>cookie.name==='h2h_session');assert.ok(native);
  const withoutGate=await browser.newContext();
  try{assert.equal((await withoutGate.request.get(origin+'/api/identity/session',{headers:{Cookie:'h2h_session='+native.value}})).status(),401)}finally{await withoutGate.close();}
  await audit(page,evidence,`cli-${width}-signed-in`);
  return session.json();
 }finally{await context.close();}
}
