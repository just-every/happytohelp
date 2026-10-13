import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {firstOwner} from './first-run/browser-kit.mjs';

const evidence=process.env.H2H_EVIDENCE_DIR||await mkdtemp(join(tmpdir(),'h2h-demo-activation-'));
await mkdir(evidence,{recursive:true});
const runtime=await createRuntime(),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const banner=page.getByRole('region',{name:'Demo workspace'});
const back=()=>banner.getByRole('button',{name:'Back to your workspace',exact:true});
const api=async(path,method='GET',body)=>page.evaluate(async({path,method,body})=>{
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error(`${method} ${path}: ${response.status}`);
  return response.json();
},{path,method,body});
let success=false;
try {
  const originalId=await firstOwner(page,runtime.origin,{email:'demo-return@example.test',password:'demo-return-browser-password',workspaceName:'Original workspace'});
  const initial=await api('/api/management/bootstrap'),userId=initial.currentAgent.id;
  const second=await api('/api/management/projects','POST',{name:'Second workspace',allowed_origin:'https://second.example.test'});
  let demoId;
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.goto(`${runtime.origin}/projects/${originalId}/conversations`);
    assert.equal(await banner.count(),0);
    await page.getByRole('button',{name:'Try a demo inbox',exact:true}).click();
    await page.waitForURL(/\/projects\/demo-[^/]+\/conversations/);
    demoId=new URL(page.url()).pathname.split('/')[2];
    await back().waitFor({state:'visible'});
    await banner.getByText('Return to Original workspace',{exact:true}).waitFor();
    await page.reload();
    await banner.getByText('Return to Original workspace',{exact:true}).waitFor();
    await page.locator('.conversation-list-items').getByText('Maya Chen (demo)',{exact:true}).click();
    await page.locator('#chat .main.main-visible').waitFor();
    const layout=await page.evaluate(()=>{
      const banner=document.querySelector('.demo-workspace-banner').getBoundingClientRect();
      const conversation=document.querySelector('#chat .main').getBoundingClientRect();
      return {bottom:banner.bottom,top:conversation.top,height:innerHeight,conversationBottom:conversation.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(layout.top>=layout.bottom-1,JSON.stringify(layout));
    assert.ok(layout.conversationBottom<=layout.height+1,JSON.stringify(layout));
    assert.equal(layout.overflow,false);
    await page.screenshot({path:join(evidence,`demo-conversation-${width}.jpg`),fullPage:true});
    for(const section of ['articles','ais','edit']) {
      await page.goto(`${runtime.origin}/projects/${demoId}/${section}`);
      await back().waitFor({state:'visible'});
      await banner.getByText('Customers, conversations and FAQs are fictional.',{exact:true}).waitFor();
      await page.screenshot({path:join(evidence,`demo-${section}-${width}.jpg`),fullPage:true});
    }
    const articles=await api(`/api/knowledge/${demoId}/articles`);
    assert.equal(articles.length,3);
    assert.ok(articles.every(article=>article.status==='published'));
    await page.goto(`${runtime.origin}/projects/${demoId}/articles/${articles[0].id}`);
    await page.getByLabel('Title',{exact:true}).fill('Unsaved demo article title');
    page.once('dialog',dialog=>dialog.dismiss());
    await back().click();
    assert.equal(new URL(page.url()).pathname,`/projects/${demoId}/articles/${articles[0].id}`);
    assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Unsaved demo article title');
    assert.equal((await api('/api/management/bootstrap')).sessionProjectId,demoId);
    page.once('dialog',dialog=>dialog.accept());
    await back().click();
    await page.waitForURL(`**/projects/${originalId}/conversations`);
    assert.equal((await api('/api/management/bootstrap')).sessionProjectId,originalId);
    assert.equal(await banner.count(),0);
    const denied=await page.evaluate(async path=>(await fetch(path)).status,`/api/knowledge/${demoId}/articles`);
    assert.equal(denied,403,'returning withdraws the demo session scope');
    const persisted=await runtime.execute(`SELECT title FROM knowledge_articles WHERE project_id='${demoId}' AND id='${articles[0].id}'`);
    assert.ok(persisted.includes(articles[0].title),'saved demo title remains unchanged');
    assert.ok(!persisted.includes('Unsaved demo article title'),'unsaved demo title was never persisted');
    await page.screenshot({path:join(evidence,`returned-${width}.jpg`),fullPage:true});
  }
  // A direct demo visit has no saved origin: require explicit choice, including
  // when a stale storage record belongs to a different signed-in user.
  await page.evaluate(({userId,demoId,originalId})=>localStorage.setItem(`h2h.demo-return.v1:${userId}`,JSON.stringify({userId:'another-user',demoId,projectId:originalId})),{userId,demoId,originalId});
  await page.goto(`${runtime.origin}/projects/${demoId}/articles`);
  await banner.getByLabel('Return workspace').waitFor();
  assert.equal(await back().isDisabled(),true);
  await banner.getByLabel('Return workspace').selectOption(second.id);
  await back().click();
  await page.waitForURL(`**/projects/${second.id}/conversations`);
  assert.equal((await api('/api/management/bootstrap')).sessionProjectId,second.id);

  // Revoke current membership after the banner loaded, exercising the live recheck.
  await page.getByRole('button',{name:'Try a demo inbox',exact:true}).click();
  await page.waitForURL(/\/projects\/demo-[^/]+\/conversations/);
  await banner.getByText('Return to Second workspace',{exact:true}).waitFor();
  await runtime.execute(`DELETE FROM memberships WHERE project_id='${second.id}' AND user_id='${userId}'`);
  await back().click();
  await banner.getByRole('alert').filter({hasText:'no longer available'}).waitFor();
  assert.equal((await api('/api/management/bootstrap')).sessionProjectId,demoId);
  assert.equal(await banner.getByLabel('Return workspace').locator('option').filter({hasText:'Second workspace'}).count(),0);
  await page.reload();
  await banner.getByRole('alert').filter({hasText:'original workspace is no longer available'}).waitFor();
  await banner.getByLabel('Return workspace').selectOption(originalId);
  await back().click();
  await page.waitForURL(`**/projects/${originalId}/conversations`);
  assert.equal((await api('/api/management/bootstrap')).sessionProjectId,originalId);

  // A deleted origin is retained as history but must not be selectable or switched to.
  await page.getByRole('button',{name:'Try a demo inbox',exact:true}).click();
  await page.waitForURL(/\/projects\/demo-[^/]+\/conversations/);
  await banner.getByText('Return to Original workspace',{exact:true}).waitFor();
  await api(`/api/management/projects/${originalId}`,'DELETE');
  await page.reload();
  await banner.getByRole('alert').filter({hasText:'original workspace is no longer available'}).waitFor();
  await banner.getByText('No other workspace is available to your account.',{exact:true}).waitFor();
  assert.equal(await back().isDisabled(),true);
  assert.equal((await api('/api/management/bootstrap')).sessionProjectId,demoId);
  assert.deepEqual(errors,[]);
  success=true;
  await writeFile(join(evidence,'result.json'),JSON.stringify({success,originalId,demoId,errors,widths:[1440,390]},null,2));
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const trackedChanges=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim();
  const files=[];
  for(const name of (await readdir(evidence)).filter(name=>name.endsWith('.jpg')||name==='result.json').sort()) files.push({name,sha256:createHash('sha256').update(await readFile(join(evidence,name))).digest('hex')});
  await writeFile(join(evidence,'manifest.json'),JSON.stringify({sha,trackedChanges,recordedAt:new Date().toISOString(),widths:[1440,390],files},null,2));
  console.log('Demo activation browser passed: persistent banner; desktop/mobile native return; reserved conversation space; unsaved guard; explicit missing/stale origin selection; current membership revocation; deleted origin; published fictional FAQ. Evidence: '+evidence);
} finally { await browser.close();await runtime.close(success); }
