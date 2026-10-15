import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRuntime} from './helpers/emitted-runtime.mjs';
import {customerFixture} from './helpers/delegation-journey/fixture.mjs';
import {client,newVisitor,runCase} from './helpers/delegation-journey/case.mjs';
import {refusals} from './helpers/delegation-journey/refusals.mjs';

const browserMode=process.argv.includes('--browser');
const evidence=resolve(process.env.H2H_EVIDENCE_DIR||await mkdtemp(join(tmpdir(),'h2h-delegation-journey-evidence-')));
await mkdir(evidence,{recursive:true});
if(browserMode){await (await import('./helpers/delegation-journey/browser.mjs')).browserJourney(evidence)}
else{
 const scratch=await mkdtemp(join(tmpdir(),'h2h-delegation-journey-')),fixture=await customerFixture();let runtime,success=false;
 try{
  runtime=await createRuntime();const {origin}=runtime;
  const password='synthetic-journey-disposable-password-123',email='journey@example.test';
  await client(origin)('/api/identity/bootstrap',{name:'Agent fix journey',email,password,allowedOrigin:origin},{status:201});
  const login=await client(origin)('/api/identity/login',{email,password}),api=client(origin,login.token);
  const outside=await newVisitor({origin,api,projectId:login.actor.projectId});await outside.say('OUTSIDE SCOPED CONVERSATION');
  const seven=await runCase({origin,api,actor:login.actor,fixture,directory:scratch});
  const deliveryFault=enabled=>runtime.execute(enabled?"CREATE TRIGGER journey_delivery_fault BEFORE UPDATE OF status ON local_receipts WHEN NEW.status='sent' BEGIN SELECT RAISE(ABORT,'Journey simulated receipt acknowledgement outage: delivery unconfirmed'); END":"DROP TRIGGER journey_delivery_fault");
  const refused=await refusals({origin,api,actor:login.actor,fixture,directory:scratch,deliveryFault});assert.equal(refused.length,4);
  await writeFile(join(evidence,'runtime-result.json'),JSON.stringify({success:true,layer:'LOCAL TEST',provider:'scripted Codex CLI boundary',customerSystem:'loopback fixture only',seven,refused},null,2));success=true;
  console.log('Delegation journey: seven steps, real connector, independent observation, exact reply replay and four same-fixture refusals passed. No live provider.');
 }finally{await fixture.close();if(runtime){await writeFile(join(evidence,'runtime.log'),runtime.logs);await runtime.close(success)}await rm(scratch,{recursive:true,force:true})}
}
