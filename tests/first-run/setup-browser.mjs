import assert from 'node:assert/strict';
import {audit,passwordLogin,firstOwner,post} from './browser-kit.mjs';

export async function setupJourney({browser,runtime,width,evidence,password,email}){
 const context=await browser.newContext({viewport:{width,height:844},bypassCSP:true}),page=await context.newPage();
 try{
  const projectId=await firstOwner(page,runtime.origin,{email,password,width});
  const checklist=page.getByTestId('activation-checklist');await checklist.getByText('0 of 8 done',{exact:true}).waitFor();
  assert.equal(await checklist.locator('.activation-trial-requirement').count(),8);
  assert.equal(await checklist.getByRole('heading',{name:'Choose the website for your widget',exact:true}).count(),1);
  assert.equal(await checklist.getByRole('heading',{name:'Connect an AI provider',exact:true}).count(),1);
  const expectedSteps=[
   ['owner_mail','Check a test email arrives',/^Not needed for a local trial\./,'Check email delivery'],
   ['sender_dns','Verify your sending address',/^Not needed for a local trial\./,'Check sending address'],
   ['inbound_address','Receive replies by email',/^Not needed for a local trial\./,'Check email replies'],
   ['model_key','Connect an AI provider',/^Not needed for a local trial with human replies\./,'Check AI connection'],
   ['spend_ceilings','Set limits for AI use',/^Not needed for a local trial with human replies\./,'Check AI limits'],
   ['published_article','Publish a help article',/^Not needed for a local trial\./,'Check article'],
   ['widget_origin','Choose the website for your widget',/^Needed for a local trial of the widget\./,'Check widget website'],
   ['widget_seen','Open the widget on your website',/^Needed for a local trial of the widget\./,'Check widget activity'],
  ];
  for(const [id,label,requirement,action] of expectedSteps){
   const step=checklist.locator(`[data-step="${id}"]`);
   assert.equal(await step.getByRole('heading',{name:label,exact:true}).count(),1);
   assert.match(await step.locator('.activation-trial-requirement').innerText(),requirement);
   assert.equal(await step.getByRole('button',{name:action,exact:true}).count(),1);
  }
  await audit(page,evidence,`${width}-first-owner-checklist`);
  await page.context().clearCookies();await passwordLogin(page,runtime.origin,email,password);await page.waitForURL(/\/activation$/);
  await audit(page,evidence,`${width}-existing-owner-checklist`);
  const login=await post(runtime.origin,'/api/identity/login',{email,password});
  for(const section of ['activation','widget-settings','articles','reports','contacts','api-settings','webhook-settings','slack-settings','delivery-log','conversations']){
   await page.goto(runtime.origin+`/projects/${projectId}/${section}`);
   await page.getByTestId('workspace-header-name').filter({hasText:'Local support '+width}).waitFor();
   if(section==='conversations'){
    await page.getByRole('link',{name:'Install the widget',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Send yourself a test message',exact:true}).getAttribute('href'),runtime.origin);
    assert.equal(await page.getByRole('button',{name:'Try a demo inbox',exact:true}).count(),1);
    await audit(page,evidence,`${width}-empty-inbox-actions`);
   }
  }
  await page.goto(runtime.origin+'/projects/create');await page.getByLabel('Name',{exact:true}).fill('Second workspace '+width);
  await page.getByLabel('Website',{exact:true}).fill(runtime.origin);await page.getByLabel('Widget website origin',{exact:true}).fill(runtime.origin);
  await page.getByRole('button',{name:'Create project',exact:true}).click();await page.waitForURL(/\/widget-settings$/);
  const secondId=new URL(page.url()).pathname.split('/')[2];assert.notEqual(secondId,projectId);
  await page.getByTestId('workspace-header-name').filter({hasText:'Second workspace '+width}).waitFor();
  const snippet=page.getByRole('heading',{name:'Install the widget',exact:false});await snippet.waitFor();
  assert.equal(await page.getByRole('button',{name:'Reveal server secret'}).isVisible(),false);
  assert.equal(await page.locator('.widget-code__advanced').getAttribute('open'),null);
  const order=await page.locator('.widget-code').evaluate(root=>[...root.querySelectorAll('section,details')].map(node=>node.getAttribute('aria-labelledby')||node.className));
  assert.equal(order[0],'widget-code-install-heading');
  const code=page.locator('.widget-code__snippet pre').first();
  assert.equal(await code.getAttribute('tabindex'),'0','scrollable code is keyboard reachable');
  await code.focus();assert.equal(await code.evaluate(element=>element===document.activeElement),true);
  await audit(page,evidence,`${width}-new-workspace-snippet`);
  await page.locator('.widget-code__advanced > summary').click();await page.getByRole('button',{name:'Reveal server secret'}).waitFor();
  assert.equal(await page.getByRole('tablist',{name:'Verification example language'}).getByRole('tab').count(),6);
  assert.equal(await page.locator('#widget-code-verification-example').isVisible(),true);
  assert.match(await page.locator('#widget-code-verification-example').innerText(),/hash_hmac/);
  await audit(page,evidence,`${width}-advanced-masked`);
  const navigation=page.getByRole('navigation',{name:'Main navigation'});
  await navigation.getByRole('button',{name:/Switch workspace:/}).click();
  await navigation.getByRole('button',{name:'Local support '+width,exact:true}).click();
  await page.getByTestId('workspace-header-name').filter({hasText:'Local support '+width}).waitFor();
  assert.ok(new URL(page.url()).pathname.startsWith(`/projects/${projectId}/`));
  await audit(page,evidence,`${width}-workspace-switched`);
  await page.goto(runtime.origin+'/setup');assert.equal(await page.getByRole('button',{name:'Create workspace',exact:true}).count(),0);
  return {projectId,token:login.token};
 }finally{await context.close();}
}
