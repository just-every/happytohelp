import assert from 'node:assert/strict';
import {apiKit,snapshot} from './browser-kit.mjs';
import {domainRecords} from './browser-provider-fixture.mjs';

export async function providerProbes({runtime,page,fixture,checks}){
 const boot=await apiKit(runtime)('/api/identity/bootstrap',{body:{email:'activation-browser@example.test',password:'activation-provider-local-password',name:'Provider activation workspace',allowedOrigin:runtime.origin},status:201});
 const projectId=boot.projectId,token=boot.token,api=apiKit(runtime,token),activation=`/api/management/projects/${projectId}/activation`,settings=`/api/management/projects/${projectId}`;
 await page.context().addCookies([{name:'h2h_session',value:token,url:runtime.origin}]);
 const step=(data,id)=>data.steps.find(s=>s.id===id),check=async id=>snapshot(await api(activation+'/check',{body:{step:id}}));
 const auto=async()=>snapshot(await api(activation+'/check',{body:{auto:true}})),modelCalls=()=>fixture.state.calls.filter(call=>call.url.startsWith('https://api.openai.com/')).length;
 // Creating the workspace sends the owner exactly one welcome email; that is the only provider traffic before the first read.
 assert.deepEqual(fixture.state.calls.map(call=>[call.method,new URL(call.url).host+new URL(call.url).pathname]),[['POST','api.resend.com/emails']],'creation sends only the one welcome email');
 fixture.state.calls.length=0;fixture.state.sendCalls=0;fixture.state.messages.clear();
 assert.equal(snapshot(await api(activation)).done,0);assert.equal(fixture.state.calls.length,0,'GET never invokes providers');
 const assistant=(await api(settings+'/ais',{body:{name:'Activation assistant',role:'Support',model:'gpt-5-mini',prompt:'Answer from sources.',is_enabled:true},status:201})).data;
 await api(settings+'/ai',{method:'PUT',body:{default_visitor_ai_id:assistant.id}});
 fixture.state.modelStatus=401;assert.equal(step(await check('model_key'),'model_key').state,'failed');
 fixture.state.modelStatus=403;assert.equal(step(await check('model_key'),'model_key').state,'unavailable');
 fixture.state.modelStatus=200;fixture.state.modelBody={id:'wrong-model',object:'model'};assert.equal(step(await check('model_key'),'model_key').state,'unknown');
 fixture.state.modelBody={id:'gpt-5-mini',object:'model'};assert.equal(step(await check('model_key'),'model_key').state,'done');
 fixture.state.modelStatus=401;assert.equal(step(await check('model_key'),'model_key').state,'failed','explicit check discovers revoked key');fixture.state.modelStatus=200;
 await api(settings+'/email-settings',{method:'PUT',body:{from_address:'support@activation.example.test',inbound_address:'inbound@activation.example.test',is_enabled:true}});
 const records=status=>domainRecords(status).map(({type,name,value})=>({type,name,value,status}));
 let data=await check('sender_dns');assert.equal(step(data,'sender_dns').state,'pending');assert.deepEqual(data.facts.senderRecords,records('pending'),'provider DNS records are listed for the owner');
 fixture.state.dns='failed';assert.equal(step(await check('sender_dns'),'sender_dns').state,'failed');fixture.state.dns='verified';assert.equal(step(await check('sender_dns'),'sender_dns').state,'done');
 assert.equal(step(await check('inbound_address'),'inbound_address').state,'pending','address saved is no receiving proof');
 await api('/api/integrations/email/inbound',{auth:'wrong-gateway-token',body:{messageId:'activation-invalid-inbound',to:'inbound@activation.example.test',from:'activation-visitor@example.test',text:'Inbound challenge'},status:403});
 assert.equal(step(await check('inbound_address'),'inbound_address').state,'pending','invalid authenticated gateway does not qualify');
 await api('/api/integrations/email/inbound',{auth:'activation-inert-inbound-token',body:{messageId:'activation-real-local-challenge',to:'inbound@activation.example.test',from:'activation-visitor@example.test',text:'Actual local inbound challenge'},status:201});
 assert.equal(step(await check('inbound_address'),'inbound_address').state,'done');
 await api(settings+'/email-settings',{method:'PUT',body:{from_address:'support@activation.example.test',inbound_address:'changed@activation.example.test',is_enabled:true}});
 assert.notEqual(step(snapshot(await api(activation)),'inbound_address').state,'done','changed mailbox invalidates delivered receipt');assert.equal(step(await check('inbound_address'),'inbound_address').state,'pending');
 assert.equal(fixture.state.sendCalls,0,'all checks including mail status never send');
 data=snapshot(await api(activation+'/test-mail',{body:{}}));assert.equal(step(data,'owner_mail').state,'pending','queue acceptance is pending');assert.equal(fixture.state.sendCalls,1);
 for(let i=0;i<2;i++){await api(activation);await check('owner_mail');await auto();await api(activation+'/test-mail',{body:{}});}assert.equal(fixture.state.sendCalls,1,'durable identity prevents repeated sends');
 fixture.state.mailEvent='bounced';assert.equal(step(await check('owner_mail'),'owner_mail').state,'failed');fixture.state.mailEvent='delivered';data=await check('owner_mail');assert.equal(step(data,'owner_mail').state,'done');assert.match(step(data,'owner_mail').receiptRef,/delivered/);
 await page.goto(`${runtime.origin}/projects/${projectId}/activation`);await page.reload();assert.equal(step(snapshot(await api(activation)),'owner_mail').state,'done');
 // A new sender configuration creates a new durable command; HTTP 5xx is uncertain.
 await api(settings+'/email-settings',{method:'PUT',body:{from_address:'other@activation.example.test',inbound_address:'changed@activation.example.test',is_enabled:true}});fixture.state.sendStatus=503;
 assert.equal(step(snapshot(await api(activation+'/test-mail',{body:{}})),'owner_mail').state,'unknown');const uncertainSends=fixture.state.sendCalls;
 await api(activation);await check('owner_mail');await auto();await api(activation+'/test-mail',{body:{}});assert.equal(fixture.state.sendCalls,uncertainSends,'uncertain send cannot replay');
 for(const body of [{done:true},{recipient:'someone@example.test'}])await api(activation+'/test-mail',{body,status:400});for(const body of [{done:true},{auto:false}])await api(activation+'/check',{body,status:400});
 const serialized=JSON.stringify(await api(activation));assert.doesNotMatch(serialized,/activation-inert-(?:model|mail)-key|activation-inert-inbound-token/,'no secrets in response');
 // While a model check is in flight, automatic checks wait on its lease; once done, repeated automatic checks reuse it.
 let release;fixture.state.modelGate=new Promise(resolve=>{release=resolve});const before=modelCalls();
 try{
  const pending=api(activation+'/check',{body:{step:'model_key'}});
  const deadline=Date.now()+15000;while(modelCalls()===before&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(step(snapshot(await api(activation)),'model_key').state,'checking');
  for(let i=0;i<3;i++)await auto();assert.equal(modelCalls(),before+1,'an automatic check does not repeat a request in flight');
  release();assert.equal(step(snapshot(await pending),'model_key').state,'done');
 }finally{release();fixture.state.modelGate=null;}
 for(let i=0;i<5;i++)await auto();assert.equal(modelCalls(),before+1,'a fresh model validation is not requested again');
 assert.equal(fixture.state.error,undefined,'HTTP fixture received only expected requests');assert.ok(fixture.state.calls.every(call=>call.method==='GET'||call.url==='https://api.resend.com/emails'),'no model generation or unexpected remote effect');
 checks.push('actual provider HTTP boundary: invalid/revoked model, permission/schema negatives, DNS pending/failed/verified with provider records, real authenticated inbound, queue vs bounce/delivery, idempotent and uncertain mail, automatic checks bounded by lease and freshness; secrets absent');
}
