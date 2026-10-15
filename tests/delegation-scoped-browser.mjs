import assert from 'node:assert/strict'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chromium} from 'playwright'
const root=new URL('..',import.meta.url).pathname,dir=await mkdtemp(join(tmpdir(),'h2h-scoped-browser-')),persist=join(dir,'state'),configPath=join(dir,'wrangler.json')
const output=process.env.H2H_EVIDENCE_DIR||dir,origin='http://127.0.0.1:8700',server=join(root,'dist/server'),wrangler=join(root,'node_modules/wrangler/bin/wrangler.js'),emitted=JSON.parse(await readFile(join(server,'wrangler.json'),'utf8'))
const setupToken='synthetic-scoped-browser-setup-private-token',env={...process.env,CI:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'}
let child,browser,logs=''
try{
 await mkdir(output,{recursive:true})
 await writeFile(configPath,JSON.stringify({...emitted,name:'h2h-scoped-browser',main:resolve(server,emitted.main),assets:{directory:resolve(server,emitted.assets.directory)},d1_databases:[{binding:'DB',database_name:'scoped-browser',database_id:'scoped-browser-local',migrations_dir:join(root,'.generated/migrations')}],r2_buckets:[{binding:'FILES',bucket_name:'scoped-browser-files'}],queues:{producers:[{binding:'JOBS',queue:'scoped-browser-jobs'}]},vars:{RER_INSTALLATION_ID:'scoped-browser',H2H_SETUP_TOKEN:setupToken},no_bundle:true}))
 await promisify(execFile)(process.execPath,[wrangler,'d1','migrations','apply','DB','--local','--config',configPath,'--persist-to',persist],{env,maxBuffer:2*1024*1024})
 child=spawn(process.execPath,[wrangler,'dev','--local','--config',configPath,'--port','8700','--inspector-port','8701','--ip','127.0.0.1','--persist-to',persist],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
 let ready=false;for(let i=0;i<160;i++){try{if((await fetch(origin+'/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,250))}assert.ok(ready,logs)
 browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const setup=await context.request.post(origin+'/api/identity/bootstrap',{data:{name:'Scoped browser',ownerName:'Owner',email:'owner@scoped.test',password:'scoped-browser-password',allowedOrigin:origin,setupToken}});assert.equal(setup.status(),201,await setup.text());const {projectId}=await setup.json()
 const article=await context.request.post(origin+`/api/knowledge/${projectId}/articles`,{data:{title:'Scoped original',content:'Original content',summary:'Original summary',status:'draft'}});assert.equal(article.status(),201);const {id}=await article.json(),target=`projects/${projectId}/articles/${id}`
 await page.goto(origin+'/delegation/settings?account_id='+projectId);await page.getByLabel('Client identifier').fill('scoped-slate');await page.getByLabel('Slate origin').fill(origin);await page.getByLabel('Exact callback URL').fill(origin+'/scoped-callback');await page.getByLabel('Allow loopback development').check();await page.getByRole('button',{name:'Register client'}).click();await page.getByText('scoped-slate —',{exact:false}).waitFor()
 const verifier='s'.repeat(64),challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url'),query=new URLSearchParams({client_id:'scoped-slate',account_id:projectId,redirect_uri:origin+'/scoped-callback',response_type:'code',state:'scoped-state',code_challenge:challenge,code_challenge_method:'S256',scope:'knowledge.article.read knowledge.article.update knowledge.article.publish',targets:JSON.stringify([target])})
 await page.goto(origin+'/delegation/authorize?'+query);await page.getByRole('heading',{name:'Connect to Slate'}).waitFor();await page.screenshot({path:join(output,'consent.png'),fullPage:true});await page.getByRole('button',{name:'Allow selected access'}).click();await page.waitForURL(/scoped-callback\?code=/);const callback=new URL(page.url());assert.equal(callback.searchParams.get('state'),'scoped-state')
 const tokenBody={grant_type:'authorization_code',client_id:'scoped-slate',redirect_uri:origin+'/scoped-callback',code:callback.searchParams.get('code'),code_verifier:verifier},exchange=(body)=>fetch(origin+'/api/delegation/v1/token',{method:'POST',body:new URLSearchParams(body)})
 assert.equal((await exchange({...tokenBody,redirect_uri:origin+'/scoped-callback/extra'})).status,401)
 const exchanged=await exchange(tokenBody);assert.equal(exchanged.status,200);const {access_token}=await exchanged.json();assert.equal((await exchange(tokenBody)).status,401)
 const api=(path,body)=>fetch(origin+'/api/delegation/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
 const current=await (await api('/evidence?target='+target)).json(),audience=await (await api('/audience?'+new URLSearchParams({target,operation:'happytohelp.article.update',intendedStatus:'published'}))).json()
 const payload={operationKey:'scoped-browser',operation:'happytohelp.article.update',target,expectedRevision:current.revision,expectedAudienceRevision:audience.audienceRevision,content:{title:'Scoped repaired article',content:'Exact delegated publication',summary:'Delegated summary',status:'published'}}
 const repair=await api('/effects',payload);assert.equal(repair.status,200,await repair.clone().text());assert.equal((await api('/effects',payload)).status,200)
 await page.goto(origin+`/projects/${projectId}/articles/${id}`);await page.locator('input').filter({visible:true}).first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(e=>e.value==='Scoped repaired article'));await page.screenshot({path:join(output,'native-article.png'),fullPage:true})
 const publicRead=await fetch(origin+`/api/knowledge/public/${projectId}/articles/`+JSON.parse(current.text).slug);assert.equal(publicRead.status,200);assert.equal((await publicRead.json()).content,payload.content.content)
 await page.goto(origin+'/delegation/settings?account_id='+projectId);await page.getByRole('button',{name:'Revoke',exact:true}).click();await page.getByText(/revoked/).waitFor();assert.equal((await api('/effects/scoped-browser')).status,401);await page.screenshot({path:join(output,'revoked.png'),fullPage:true});assert.deepEqual(errors,[])
 console.log('Scoped browser passed: native allowlist, consent, exact callback, one-use code, delegated publication, duplicate replay, native editor, public readback, native revocation; app8700 inspector8701')
}finally{
 await browser?.close();if(child){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.exitCode!==null?r():child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)child.kill('SIGKILL')}
 await writeFile(join(output,'browser-runtime.log'),logs);if(output!==dir)await rm(dir,{recursive:true,force:true})
}
