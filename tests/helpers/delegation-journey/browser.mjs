import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {command,run} from '../rer-command.mjs';
import {customerFixture} from './fixture.mjs';
import {report,client,runCase,until} from './case.mjs';
import {browserUI} from './browser-ui.mjs';

export async function browserJourney(evidence){
 const scratch=await mkdtemp(join(tmpdir(),'h2h-agent-fix-rer-')),checkout=join(scratch,'checkout');
 const fixture=await customerFixture();let server,browser;const captions=[],checks=[];
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const origin=`http://127.0.0.1:${port}`,email='agent-fix@example.test',password=randomBytes(24).toString('base64url');
 let success=false;
 try{
  await promisify(execFile)('git',['clone','--quiet','--no-local','--depth','1',resolve('.'),checkout]);
  await run(checkout,['install']);
  await mkdir(join(checkout,'.seed'),{mode:0o700,recursive:true});
  await writeFile(join(checkout,'.seed/local-answers.json'),JSON.stringify({WORKSPACE_NAME:'Agent fix journey',WIDGET_ORIGIN:origin,OWNER_NAME:'Journey owner',OWNER_PASSWORD:password,EMAIL_PROVIDER:'later'}),{mode:0o600});
  await run(checkout,['setup','--owner-email',email,'--answers','.seed/local-answers.json','--port',String(port)]);
  await assert.rejects(fetch(origin+'/health',{signal:AbortSignal.timeout(2000)}),'setup leaves no server');
  server=command(checkout,['dev']);const ready=await server.waitFor(event=>event.event==='ready',180000);assert.equal(ready.url,origin);assert.equal(ready.signInUrl,origin+'/__dev/outbox');
  browser=await chromium.launch({headless:true});
  const loginContext=await browser.newContext(),loginPage=await loginContext.newPage();
  await loginPage.goto(origin+'/__dev/outbox');await loginPage.getByRole('link',{name:'Read message'}).first().click();await loginPage.getByRole('link',{name:'Open this link'}).click();
  await loginPage.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal((await loginContext.request.get(origin+'/api/identity/session')).status(),401);
  await loginPage.getByRole('button',{name:'Sign in',exact:true}).click();await loginPage.waitForURL(/\/projects\/[^/]+\/activation$/);
  const session=await loginContext.request.get(origin+'/api/identity/session');assert.equal(session.status(),200);const actor=await session.json();assert.equal(actor.role,'owner');
  const state=await loginContext.storageState();await loginContext.close();
  for(const width of [1440,390]){
   const viewport={width,height:width===390?844:1000},context=await browser.newContext({viewport,storageState:state}),page=await context.newPage();
   const cookie=(await context.cookies()).find(c=>c.name==='h2h_session');assert.ok(cookie);const api=client(origin,cookie.value);
   const project=await api('/api/identity/projects/'+actor.projectId);const errors=[];page.on('pageerror',error=>errors.push(error.message));
   const directory=join(scratch,String(width));await mkdir(directory);
   let visitorContext,visitor,visitorSession;const frames=[];
   const ui=browserUI({page,context,origin,actor,api,width,evidence,captions});
   ui.visitor=async()=>{
    visitorContext=await browser.newContext({viewport});visitor=await visitorContext.newPage();visitor.on('pageerror',error=>errors.push(error.message));
    visitor.on('websocket',socket=>socket.on('framereceived',event=>{try{frames.push(JSON.parse(event.payload))}catch{}}));
    const mount=async()=>{await visitor.addScriptTag({url:origin+'/widget.js'});await visitor.evaluate(options=>window.h2h('init',options),{widgetKey:project.widget_key,apiOrigin:origin,open:true,settings:{collector:{enabled:false}}})};
    await visitor.goto(origin+'/help/'+actor.projectId);await mount();
    await visitor.locator('textarea[name=content]').fill(report);await visitor.locator('button[name=submit]').click();
    visitorSession=await until(()=>visitor.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),`rer-widget:${origin}:${project.widget_key}`),s=>s?.conversationId,'widget session');
    const transcript=()=>client(origin,visitorSession.token)('/api/conversations/'+visitorSession.conversationId+'/messages');
    ui.visitorPage=visitor;
    ui.received=async(body,messageId)=>{
     await visitor.getByText(body,{exact:true}).waitFor();await until(()=>Promise.resolve(frames.filter(f=>f.message?.id===messageId)),messages=>messages.length===1,'one visitor socket delivery');
     assert.equal(await visitor.getByText(body,{exact:true}).count(),1);assert.equal(frames.filter(f=>f.message?.id===messageId).length,1);
     await visitor.reload();await mount();await visitor.getByText(body,{exact:true}).waitFor();assert.equal(await visitor.getByText(body,{exact:true}).count(),1);
    };
    return {session:visitorSession,transcript,close:()=>visitorContext.close()};
   };
   try{checks.push({width,...await runCase({origin,api,actor,fixture,directory,ui})});assert.deepEqual(errors,[])}finally{await visitorContext?.close();await context.close()}
  }
  success=true;console.log('Fresh rer install/setup/dev/outbox agent-fix browser journey passed at 1440 and 390 with operator and widget screenshots for all seven steps.');
 }finally{
  await browser?.close();if(server){await run(checkout,['dev','--stop']);await server.stop()}
  await fixture.close();await writeFile(join(evidence,'browser-result.json'),JSON.stringify({success,layer:'LOCAL TEST',provider:'scripted Codex CLI boundary',liveProvider:false,customerSystem:'loopback fixture only',freshInstalledRer:true,ordinaryOutboxSignIn:true,checks},null,2));
  await writeFile(join(evidence,'SCREENSHOTS.md'),captions.join('\n')+'\n');await rm(scratch,{recursive:true,force:true});
 }
}
