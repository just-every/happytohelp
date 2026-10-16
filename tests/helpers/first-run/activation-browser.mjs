import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRuntime} from '../../activation/browser-runtime.mjs';
import {providerFixture} from '../../activation/browser-provider-fixture.mjs';
import {providerProbes} from '../../activation/browser-provider-probes.mjs';
import {apiKit,setup,snapshot} from '../../activation/browser-kit.mjs';
import {spendViews} from '../../activation/browser-spend.mjs';
import {widgetProbes} from '../../activation/browser-widget-probes.mjs';
import {localProbes} from '../../activation/browser-local-probes.mjs';
import {freshViews,knowledgeViews,demoAndAiViews} from '../../activation/browser-ui.mjs';
import {launchBrowser} from '../../journeys/kit/browser.mjs';

// Local synthetic installation only. No hosted/provider/timed-install claim.
export async function activationBrowser(){
 const evidence=process.env.H2H_EVIDENCE_DIR?resolve(process.env.H2H_EVIDENCE_DIR):await mkdtemp(join(tmpdir(),'h2h-activation-browser-'));
 await mkdir(evidence,{recursive:true});
 const emittedConfig=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
 const emittedMain=resolve('dist/server',emittedConfig.main);
 const emittedSha256=createHash('sha256').update(await readFile(emittedMain)).digest('hex');
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 let runtime=await createRuntime();let browser,page,fixture,success=false;
 const errors=[],failed=[],checks=[],artifacts=[],responseChecks=[],expectedHttp=[];
 const observePage=observed=>{observed.setDefaultTimeout(15000);observed.on('pageerror',error=>errors.push(error.message));observed.on('response',response=>{if(response.status()<400)return;const expected=observed.expectedProviderFailure;responseChecks.push((async()=>{const text=await response.text();const entry={url:response.url(),status:response.status()};if(expected&&/CONFIGURATION_REQUIRED: [A-Z_]+_API_KEY/.test(text))expectedHttp.push(entry);else failed.push(entry);})());});observed.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')failed.push({url:request.url(),error:request.failure()?.errorText});});};
 try{
  browser=await launchBrowser();page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
  observePage(page);
  const projectId=await setup(page,runtime.origin);
  const login=await apiKit(runtime)('/api/identity/login',{body:{email:'activation-browser@example.test',password:'synthetic-activation-browser-local-password'}}),token=login.token;
  const activation=`/api/management/projects/${projectId}/activation`;
  const api=apiKit(runtime,token);snapshot(await api(activation));
  await freshViews({page,runtime,projectId,evidence,artifacts,checks});
  await localProbes({runtime,page,projectId,token,activation,checks});
  await knowledgeViews({page,runtime,projectId,evidence,artifacts,checks});
  await demoAndAiViews({page,runtime,projectId,evidence,artifacts,checks});
  await spendViews({runtime,page,projectId,token,evidence,artifacts,checks});
  await widgetProbes({runtime,page,projectId,token,activation,checks});
  await page.context().close();await runtime.close(true);runtime=null;
  fixture=await providerFixture({port:Number(process.env.H2H_PROVIDER_FIXTURE_PORT)||0});
  runtime=await createRuntime({providerFixtureOrigin:fixture.origin,vars:{OPENAI_API_KEY:'synthetic-activation-inert-model-key',EMAIL_PROVIDER:'resend',EMAIL_API_KEY:'synthetic-activation-inert-mail-key',EMAIL_FROM:'support@activation.example.test',INBOUND_EMAIL_TOKEN:'synthetic-activation-inert-inbound-token'}});
  page=await browser.newPage({viewport:{width:1440,height:1000}});observePage(page);
  await providerProbes({runtime,page,fixture,evidence,artifacts,checks});
  await Promise.all(responseChecks);assert.deepEqual(errors,[],'browser errors');assert.deepEqual(failed,[],'unexpected failed requests');success=true;
 }finally{
  await writeFile(join(evidence,'manifest.json'),JSON.stringify({sourceSha:sha,nodeVersion:process.version,emittedMain,emittedSha256,utc:new Date().toISOString(),kind:'local-only emitted Worker/D1/R2 synthetic-owner browser',success,checks,errors,failed,expectedHttp,artifacts},null,2)+'\n');await browser?.close();await runtime?.close(success);await fixture?.close();
 }
 console.log('Activation browser passed:',evidence);
}
