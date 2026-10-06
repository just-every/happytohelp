import assert from 'node:assert/strict';

export async function rapidTenantBack(page,alpha,beta) {
  const nav=page.getByRole('navigation',{name:'Main navigation'}),before=page.url();
  const origin=await page.evaluate(()=>performance.timeOrigin);
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const pattern=`**/api/management/bootstrap?projectId=${beta.id}`;
  await page.route(pattern,async route=>{await gate;await route.continue().catch(error=>{if(!/already handled|closed|cancel/i.test(error.message))throw error;});});
  try {
    const pending=page.waitForRequest(request=>request.url().includes(`/api/management/bootstrap?projectId=${beta.id}`));
    await nav.getByRole('button',{name:/Switch workspace:/}).click();
    await nav.getByRole('button',{name:'Navigation Beta',exact:true}).click();
    const request=await pending;
    await page.waitForURL(url=>url.pathname===`/projects/${beta.id}/conversations`);
    assert.equal(await nav.getByRole('button',{name:'Switch workspace: Navigation Alpha',exact:true}).count(),1,'pending tenant keeps committed Alpha scope');
    await page.goBack();await page.waitForURL(before);release();
    await request.response().catch(()=>null);
    await nav.getByRole('button',{name:'Switch workspace: Navigation Alpha',exact:true}).waitFor();
    await page.waitForFunction(()=>document.body.dataset.workspaceMode==='light');
    await page.keyboard.press('Escape');
    await nav.getByRole('link',{name:/All open/}).click();
    await page.locator('.conversation-list-items').getByText('Alpha Visitor',{exact:true}).waitFor();
    assert.equal(await page.locator('.conversation-list-items').getByText('Beta Visitor',{exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
  } finally {release();await page.unroute(pattern);}
}

export async function pluginPrefill(page) {
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  const settings=nav.getByRole('button',{name:'Settings',exact:true});
  if(await settings.getAttribute('aria-expanded')!=='true')await settings.click();
  const more=nav.locator('details.native-extra-settings');if(await more.getAttribute('open')===null)await more.locator('summary').click();
  await nav.getByRole('link',{name:'Integrations',exact:true}).click();
  const requests=[],origin=new URL(page.url()).origin;
  const observe=request=>requests.push({method:request.method(),url:request.url()});
  page.on('request',observe);
  try {
    const add=page.getByRole('link',{name:'Add Custom Plugin',exact:true});
    const target=new URL(await add.getAttribute('href'),page.url());
    assert.equal(target.origin,origin);
    assert.match(target.pathname,/\/plugins\/create$/);
    await add.click();await page.waitForURL(target.href);
    const name=page.getByLabel('Name',{exact:true}),url=page.getByLabel('URL',{exact:true});
    await name.waitFor();assert.equal(await name.inputValue(),'');assert.equal(await url.inputValue(),'');
    target.search=new URLSearchParams({name:'Custom support panel',url:'https://plugins.example.test/support?view=customer'}).toString();
    await page.goto(target.href);await name.waitFor();
    assert.equal(await name.inputValue(),target.searchParams.get('name'));
    assert.equal(await url.inputValue(),target.searchParams.get('url'));
    assert.equal(await url.evaluate(input=>input.checkValidity()),true);
    for(const unsafe of ['javascript:alert(1)','data:text/html,unsafe','http://plugins.example.test/support']) {
      await url.fill(unsafe);await page.getByRole('button',{name:'Add',exact:true}).click();
      await page.locator('#url-error').waitFor();
      assert.match(await page.locator('#url-error').innerText(),/https/i);
      assert.equal(await url.getAttribute('aria-invalid'),'true');
    }
    await url.fill(target.searchParams.get('url'));
    assert.equal(await page.locator('#url-error').count(),0);
    assert.equal(await url.evaluate(input=>input.checkValidity()),true);
    assert.deepEqual(requests.filter(request=>!['GET','HEAD','OPTIONS'].includes(request.method)),[],'prefill and validation never save');
    assert.deepEqual(requests.filter(request=>new URL(request.url).origin!==origin),[],'prefill and validation never access a provider');
  } finally {page.off('request',observe);}
  page.once('dialog',dialog=>dialog.accept());
  await nav.getByRole('link',{name:'Inbox',exact:true}).click();await page.locator('.conversation-inbox').waitFor();
}
