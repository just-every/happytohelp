import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {apiKit,setup,snapshot} from './activation/browser-kit.mjs';
import {spendViews} from './activation/browser-spend.mjs';
import {widgetProbes} from './activation/browser-widget-probes.mjs';
import {localProbes} from './activation/browser-local-probes.mjs';
import {freshViews,knowledgeViews,demoAndAiViews} from './activation/browser-ui.mjs';

// Local synthetic installation only. No hosted/provider/timed-install claim.
const {chromium}=await import(process.env.H2H_PLAYWRIGHT_MODULE||'playwright');
const evidence=process.env.H2H_EVIDENCE_DIR?resolve(process.env.H2H_EVIDENCE_DIR):await mkdtemp(join(tmpdir(),'h2h-activation-browser-'));
await mkdir(evidence,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','activation browser evidence requires committed source');
const runtime=await createRuntime();let browser,page,success=false;
const errors=[],failed=[],checks=[],artifacts=[];
try{
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')failed.push({url:request.url(),error:request.failure()?.errorText});});
 const projectId=await setup(page,runtime.origin);
 const login=await apiKit(runtime)('/api/identity/login',{body:{email:'activation-browser@example.test',password:'activation-browser-local-password'}}),token=login.token;
 const activation=`/api/management/projects/${projectId}/activation`;
 const api=apiKit(runtime,token);assert.equal(snapshot(await api(activation)).done,0);
 await freshViews({page,runtime,projectId,evidence,artifacts,checks});
 await localProbes({runtime,page,projectId,token,activation,checks});
 await knowledgeViews({page,runtime,projectId,evidence,artifacts,checks});
 await demoAndAiViews({page,runtime,projectId,evidence,artifacts,checks});
 await spendViews({runtime,page,projectId,token,evidence,artifacts,checks});
 await widgetProbes({runtime,projectId,token,activation,checks});
 assert.deepEqual(errors,[],'browser errors');assert.deepEqual(failed,[],'unexpected failed requests');success=true;
}finally{
 await writeFile(join(evidence,'manifest.json'),JSON.stringify({sourceSha:sha,utc:new Date().toISOString(),kind:'local-only emitted Worker/D1/R2 synthetic-owner browser',success,checks,errors,failed,artifacts},null,2)+'\n');await browser?.close();await runtime.close(success);
}
console.log('Activation browser passed:',evidence);
