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
  await page.getByRole('link',{name:'Enable ChargeDesk',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'ChargeDesk');
  assert.equal(await page.getByLabel('URL',{exact:true}).inputValue(),'https://app.chargedesk.com/installed/happytohelp');
  await nav.getByRole('link',{name:'Inbox',exact:true}).click();await page.locator('.conversation-inbox').waitFor();
}
