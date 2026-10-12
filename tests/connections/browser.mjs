import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {createRuntime} from '../helpers/emitted-runtime.mjs';
const directory=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/connections');await mkdir(directory,{recursive:true});
const runtime=await createRuntime({outboundFixture:new URL('./browser-network.mjs',import.meta.url).href,vars:{INTEGRATION_ENCRYPTION_KEY:randomBytes(32).toString('base64')}});let browser,success=false;const records=[];
async function audit(page,name){await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});const violations=await page.evaluate(async()=>{const result=await axe.run();return result.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({id:x.id,impact:x.impact,targets:x.nodes.map(n=>n.target)}))});assert.deepEqual(violations,[],name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');await page.screenshot({path:join(directory,name+'.png'),fullPage:true});records.push({name,violations})}
try{

browser=await chromium.launch({headless:true});const owner=await runtime.seedTenant({name:'Connections workspace',email:'connections@example.test'});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'h2h_session',value:owner.token,url:runtime.origin}]);const page=await context.newPage();page.setDefaultTimeout(20000);
  const open=section=>page.goto(runtime.origin+`/projects/${owner.projectId}/${section}`);
  await open('api-settings');await page.getByLabel('Token name',{exact:true}).fill('Browser token '+width);await page.getByLabel('contacts:read',{exact:true}).check();await page.getByRole('button',{name:'Create token',exact:true}).click();await page.getByRole('button',{name:'Dismiss token',exact:true}).click();assert.equal(await page.getByLabel('New token',{exact:true}).count(),0);await audit(page,'api-'+width);await page.getByRole('button',{name:'Revoke Browser token '+width,exact:true}).click();await page.getByText('Revoked',{exact:true}).first().waitFor();
  await open('webhook-settings');await page.getByLabel('Connection name',{exact:true}).fill('Browser webhook '+width);await page.getByLabel('HTTPS receiver URL',{exact:true}).fill('https://receiver.example.com/browser');await page.getByRole('button',{name:'Save connection',exact:true}).click();await page.getByRole('button',{name:'Dismiss secret',exact:true}).click();assert.equal(await page.getByLabel('Signing secret (hex)',{exact:true}).count(),0);await page.getByRole('button',{name:'Send test to Browser webhook '+width,exact:true}).click();await page.getByText('Test recorded. Check the delivery log for its outcome.',{exact:true}).waitFor();await audit(page,'webhooks-'+width);
  await open('slack-settings');await page.getByLabel('Connection name',{exact:true}).fill('Browser Slack '+width);await page.getByLabel('Slack connection type',{exact:true}).selectOption('bot');await page.getByLabel('Bot token',{exact:true}).fill('xoxb-browser-protocol-fixture');await page.getByLabel('Channel ID',{exact:true}).fill('C12345678');await page.getByRole('button',{name:'Save connection',exact:true}).click();await page.getByRole('button',{name:'Send test to Browser Slack '+width,exact:true}).waitFor();assert.equal(await page.getByLabel('Bot token',{exact:true}).inputValue(),'');await audit(page,'slack-'+width);await page.getByRole('button',{name:'Send test to Browser Slack '+width,exact:true}).click();await page.getByText('Test recorded. Check the delivery log for its outcome.',{exact:true}).waitFor();
  await open('delivery-log');await page.getByText('Error class: webhook_rejected',{exact:true}).first().waitFor();await audit(page,'delivery-log-'+width);await context.close();
 }
 await writeFile(join(directory,'connections-browser.json'),JSON.stringify({records,migrations:runtime.migrationCount,boundary:'Actual emitted Worker; synthetic network responses through ordinary fetch; no external sends or live Slack'},null,2)+'\n');success=true;
}finally{if(browser)await browser.close();await runtime.close(success)}
