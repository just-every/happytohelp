import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {hero} from './helpers/hero/flow.mjs';
const directory=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/hero-connector');
await mkdir(directory,{recursive:true});
const runtime=await createRuntime();let browser,success=false;
try{
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const tenant=await runtime.seedTenant({name:'Hero '+viewport.width,email:`owner-${viewport.width}@hero.test`,allowedOrigin:runtime.origin});
  const cookie=`h2h_session=${tenant.token}`;await context.addCookies([{name:'h2h_session',value:tenant.token,url:runtime.origin}]);
  const project=await context.request.get(runtime.origin+`/api/identity/projects/${tenant.projectId}`);assert.equal(project.status(),200);const widgetKey=(await project.json()).widget_key;
  const article={slug:'contact-your-support-team',title:'Contact your support team',content:'Open the website chat widget, type your question, and press Send. The support team can reply in the same conversation.',summary:'Contact the support team.',status:'draft'};
  const created=await context.request.post(runtime.origin+`/api/knowledge/${tenant.projectId}/articles`,{data:article});assert.equal(created.status(),201);article.id=(await created.json()).id;
  const output=join(directory,String(viewport.width));await mkdir(output,{recursive:true});
  await hero({browser,operator:{context,page,cookie},origin:runtime.origin,bootstrap:{projectId:tenant.projectId,userId:tenant.userId,widgetKey,article},directory:output,viewport});
  assert.deepEqual(errors,[]);await context.close();
 }
 success=true;console.log('Hero connector PASS: 1440x900 and 390x844; actual pairing + connector child, native article 404→201→200, resolve draft, Use, Send, visitor socket/reload stable identity. Provider fixture only.');
}finally{await browser?.close();await runtime.close(success)}
