import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {command,run} from './helpers/rer-command.mjs';
import {waitForServingCapacity} from './helpers/serving-capacity.mjs';
import {archiveSnapshot,archiveStorage,retainHistoricalLedger,assertHistoricalLedger,compareArchive} from './helpers/rer-archive.mjs';
import {seedPortableData,verifyPortableData} from './helpers/rer-data.mjs';

// One maintained public command journey replaces the standalone installer flow.
const source=fileURLToPath(new URL('..',import.meta.url));
const scratch=await mkdtemp(join(tmpdir(),'h2h-rer-journey-')),root=join(scratch,'checkout');
const execute=promisify(execFile);
let server,browser;
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const email='rer-journey@example.test',password=randomBytes(24).toString('base64url');
const origin=`http://127.0.0.1:${port}`;
const setup=['setup','--owner-email',email,'--answers','.seed/local-answers.json','--port',String(port)];
const json=async(path,body,token)=>{
 const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal(response.ok,true,`Native ${path} must succeed`);return response.json();
};
async function start(){
 await waitForServingCapacity();
 server=command(root,['dev']);
 const ready=await server.waitFor(event=>event.event==='ready',180000);
 assert.equal(ready.url,origin);assert.equal(ready.signInUrl,origin+'/__dev/outbox');
 assert.equal((await json('/health')).status,'ok');
}
async function stop(){
 if(!server)return;
 await run(root,['dev','--stop']);
 const result=await server.result();assert.ok([0,130,143].includes(result.code));
 await server.stop();server=undefined;
 await assert.rejects(fetch(origin+'/health',{signal:AbortSignal.timeout(2000)}));
}
async function signIn(){
 const context=await browser.newContext(),page=await context.newPage();
 try{
  await page.goto(origin+'/__dev/outbox');
  await page.getByRole('link',{name:'Read message'}).first().click();
  const link=await page.getByRole('link',{name:'Open this link'}).getAttribute('href');
  assert.ok(link,'ordinary outbox sign-in must exist');
  assert.equal((await context.request.get(link)).status(),200);
  assert.equal((await context.request.get(origin+'/api/identity/session')).status(),401);
  await page.getByRole('link',{name:'Open this link'}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  assert.equal((await context.request.get(origin+'/api/identity/session')).status(),401);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(/\/projects\/[^/]+\/activation$/); // Sign-in returns to /setup, which sends the claimed owner on to first-run steps.
  const response=await context.request.get(origin+'/api/identity/session');assert.equal(response.status(),200);
  const actor=await response.json();
  const replay=await browser.newContext();
  try{
   const retry=await replay.newPage();await retry.goto(link);
   const consumed=retry.waitForResponse(response=>new URL(response.url()).pathname==='/api/identity/magic-link/consume'&&response.request().method()==='POST');
   await retry.getByRole('button',{name:'Sign in',exact:true}).click();
   assert.equal((await consumed).status(),400,'replay must be refused after its POST completes');
   assert.equal((await replay.request.get(origin+'/api/identity/session')).status(),401);
  }finally{await replay.close();}
  return actor;
 }finally{await context.close();}
}
try{
 await execute('git',['clone','--quiet','--no-local','--depth','1',source,root]);
 await run(root,['check','--profile','first-party']);
 await run(root,['install']);
 await mkdir(join(root,'.seed'),{mode:0o700,recursive:true});
 await writeFile(join(root,'.seed/local-answers.json'),JSON.stringify({WORKSPACE_NAME:'Rer support',WIDGET_ORIGIN:'https://example.test',PRIMARY_COLOR:'#7c3aed',OWNER_NAME:'Rer owner',OWNER_PASSWORD:password,EMAIL_PROVIDER:'later'}),{mode:0o600});
 await run(root,setup);
 await assert.rejects(fetch(origin+'/health',{signal:AbortSignal.timeout(2000)}),'setup must leave no runtime');
 await run(root,['setup','--owner-email','other-owner@example.test','--answers','.seed/local-answers.json','--port',String(port)],4); // A different owner is refused before any change.
 const privateBefore=await readFile(join(root,'.dev.vars'));
 assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
 await start();browser=await chromium.launch({headless:true});
 const actor=await signIn();assert.equal(actor.role,'owner');assert.ok(actor.id);
 const login=await json('/api/identity/login',{email,password});assert.equal(login.actor.id,actor.id);
 const project=await json('/api/management/projects',{name:'Retained workspace',allowedOrigin:origin},login.token);
 await run(root,['reset','--yes'],4); // Active-state refusal.
 await stop();await run(root,setup);
 assert.ok(privateBefore.equals(await readFile(join(root,'.dev.vars'))),'setup must preserve exact private bytes');
 await start();const retained=await json('/api/identity/login',{email,password});
 assert.equal(retained.actor.id,actor.id);
 assert.ok((await json('/api/management/projects',undefined,retained.token)).data.some(row=>row.id===project.id));
 const portable=await seedPortableData(origin,project.id,retained.token,json);
 await stop();
 const historical=await retainHistoricalLedger(root);
 const before=await archiveSnapshot(root);
 assert.ok(before.rows.move_in_runs.length>0 && before.rows.contact_erasures.length>0 && before.objects.length>0);
 await run(root,['export','--output','exports/support.rer']);
 assert.equal((await stat(join(root,'exports/support.rer'))).mode&0o777,0o600);
 await assertHistoricalLedger(root,historical);
 await run(root,['import','--input','exports/support.rer','--yes'],4);
 compareArchive(before,await archiveSnapshot(root));
 // A valid archive with unknown schema must refuse on an empty target;
 // the known older archive must bridge to a later additive migration.
 const additive=join(root,'migrations/9999_rer_journey.sql');
 await archiveStorage(root,async({DB})=>DB.prepare('CREATE TABLE unknown_archive_table(id TEXT PRIMARY KEY)').run());
 // A valid archive of an unknown source schema must still be refused.
 await run(root,['export','--output','exports/later.rer']);
 await run(root,['reset'],4);await access(join(root,'.dev.vars'));
 await run(root,['reset','--yes']);await access(join(root,'exports/support.rer'));await access(__rerTestEntry);
 await run(root,['reset','--yes']);
 await run(root,['import','--input','exports/later.rer','--yes'],4);
 const empty=await archiveSnapshot(root);assert.equal(empty.rows.users.length,0);assert.equal(empty.objects.length,0);
 await writeFile(additive,'CREATE TABLE rer_journey_additive(id TEXT PRIMARY KEY, value TEXT);\n');
 await run(root,['import','--input','exports/support.rer','--yes']);
 compareArchive(before,await archiveSnapshot(root),['rer_journey_additive']);
 const migrationCount=()=>archiveStorage(root,async({DB})=>(await DB.prepare("SELECT count(*) n FROM d1_migrations WHERE name='9999_rer_journey.sql'").first()).n);
 assert.equal(await migrationCount(),1);
 await run(root,setup);await start();
 const restored=await json('/api/identity/login',{email,password});assert.equal(restored.actor.id,actor.id);
 assert.ok((await json('/api/management/projects',undefined,restored.token)).data.some(row=>row.id===project.id));
 await verifyPortableData(origin,portable,restored.token,json);
 await stop();assert.equal(await migrationCount(),1);
 await run(root,['deploy','--dry-run']);
 await run(root,['reset','--yes']);await rm(additive);await run(root,setup);await start();
 const fresh=await json('/api/identity/login',{email,password});assert.notEqual(fresh.actor.id,actor.id);
 assert.equal((await json('/api/management/projects',undefined,fresh.token)).data.length,1);
 await stop();
 // The owner's export remains in the checkout; generated files do not alter source.
 assert.equal((await execute('git',['status','--porcelain','--untracked-files=no'],{cwd:root})).stdout,'','journey preserves tracked source');
 console.log('Rer fresh-clone journey passed: install, setup/teardown, dev/health, ordinary one-use outbox sign-in, retained owner/settings/data, active/unconfirmed reset refusal, private export/import, historical ledger custody, additive replay once, incompatible/nonempty refusal, all D1/R2 rows/bytes, import custody and erasure fences, deploy dry-run, reset and fresh owner.');
}catch(error){
 // Browser diagnostics can contain one-use fragment capabilities; emit only a safe source location.
 const line=/rer-journey\.mjs:(\d+):/.exec(error.stack||'')?.[1]||'unknown';
 const diagnostic=/^Rer (?:dev|preview) (?:exited \d+ before the required event|exceeded its deadline); [a-z_]+, (?:machine load|disk space|server capacity|active operation|see private capture)$/.test(error.message??'')?`; ${error.message}`:'';
 throw Error(`Rer journey failed (${error.name}, source line ${line}${diagnostic}); private browser diagnostics withheld.`);
}finally{
 if(browser)await browser.close();if(server)await server.stop();
 await rm(scratch,{recursive:true,force:true});
}
