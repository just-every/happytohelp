import assert from 'node:assert/strict';
import {apiKit,snapshot,capture,axeChecklist,noOverflow} from './browser-kit.mjs';

export async function providerProbes({runtime,page,fixture,evidence,artifacts,checks}){
 const boot=await apiKit(runtime)('/api/identity/bootstrap',{body:{email:'activation-browser@example.test',password:'activation-provider-local-password',name:'Provider activation workspace',allowedOrigin:runtime.origin},status:201});
 const projectId=boot.projectId,token=boot.token,api=apiKit(runtime,token),activation=`/api/management/projects/${projectId}/activation`,settings=`/api/management/projects/${projectId}`;
 await page.context().addCookies([{name:'h2h_session',value:token,url:runtime.origin}]);
 const step=(data,id)=>data.steps.find(s=>s.id===id),check=async id=>snapshot(await api(activation+'/check',{body:{step:id}}));
 assert.equal(snapshot(await api(activation)).done,0);assert.equal(fixture.state.calls.length,0,'GET never invokes providers');
 const assistant=(await api(settings+'/ais',{body:{name:'Activation assistant',role:'Support',model:'gpt-5-mini',prompt:'Answer from sources.',is_enabled:true},status:201})).data;
 await api(settings+'/settings',{method:'PUT',body:{default_responder:assistant.id}});
 fixture.state.modelStatus=401;assert.equal(step(await check('model_key'),'model_key').state,'failed');
 fixture.state.modelStatus=403;assert.equal(step(await check('model_key'),'model_key').state,'unavailable');
 fixture.state.modelStatus=200;fixture.state.modelBody={id:'wrong-model',object:'model'};assert.equal(step(await check('model_key'),'model_key').state,'unknown');
 fixture.state.modelBody={id:'gpt-5-mini',object:'model'};assert.equal(step(await check('model_key'),'model_key').state,'done');
 fixture.state.modelStatus=401;assert.equal(step(await check('model_key'),'model_key').state,'failed','explicit check discovers revoked key');fixture.state.modelStatus=200;
 await api(settings+'/email-settings',{method:'PUT',body:{from_address:'support@activation.example.test',inbound_address:'inbound@activation.example.test',is_enabled:true}});
 assert.equal(step(await check('sender_dns'),'sender_dns').state,'pending');fixture.state.dns='failed';assert.equal(step(await check('sender_dns'),'sender_dns').state,'failed');fixture.state.dns='verified';assert.equal(step(await check('sender_dns'),'sender_dns').state,'done');
 assert.equal(step(await check('inbound_address'),'inbound_address').state,'pending','address saved is no receiving proof');
 await api('/api/integrations/email/inbound',{auth:'wrong-gateway-token',body:{messageId:'activation-invalid-inbound',to:'inbound@activation.example.test',from:'activation-visitor@example.test',text:'Inbound challenge'},status:403});
 assert.equal(step(await check('inbound_address'),'inbound_address').state,'pending','invalid authenticated gateway does not qualify');
 await api('/api/integrations/email/inbound',{auth:'activation-inert-inbound-token',body:{messageId:'activation-real-local-challenge',to:'inbound@activation.example.test',from:'activation-visitor@example.test',text:'Actual local inbound challenge'},status:201});
 assert.equal(step(await check('inbound_address'),'inbound_address').state,'done');
 await api(settings+'/email-settings',{method:'PUT',body:{from_address:'support@activation.example.test',inbound_address:'changed@activation.example.test',is_enabled:true}});
 assert.notEqual(step(snapshot(await api(activation)),'inbound_address').state,'done','changed mailbox invalidates delivered receipt');assert.equal(step(await check('inbound_address'),'inbound_address').state,'pending');
 assert.equal(fixture.state.sendCalls,0,'all checks including mail status never send');
 let data=snapshot(await api(activation+'/test-mail',{body:{}}));assert.equal(step(data,'owner_mail').state,'pending','queue acceptance is pending');assert.equal(fixture.state.sendCalls,1);
 for(let i=0;i<2;i++){await api(activation);await check('owner_mail');await api(activation+'/test-mail',{body:{}});}assert.equal(fixture.state.sendCalls,1,'durable identity prevents repeated sends');
 fixture.state.mailEvent='bounced';assert.equal(step(await check('owner_mail'),'owner_mail').state,'failed');fixture.state.mailEvent='delivered';data=await check('owner_mail');assert.equal(step(data,'owner_mail').state,'done');assert.match(step(data,'owner_mail').receiptRef,/delivered/);
 await page.goto(`${runtime.origin}/projects/${projectId}/activation`);await page.reload();assert.equal(step(snapshot(await api(activation)),'owner_mail').state,'done');
 // A new sender configuration creates a new durable command; HTTP 5xx is uncertain.
 await api(settings+'/email-settings',{method:'PUT',body:{from_address:'other@activation.example.test',inbound_address:'changed@activation.example.test',is_enabled:true}});fixture.state.sendStatus=503;
 assert.equal(step(snapshot(await api(activation+'/test-mail',{body:{}})),'owner_mail').state,'unknown');const uncertainSends=fixture.state.sendCalls;
 await api(activation);await check('owner_mail');await api(activation+'/test-mail',{body:{}});assert.equal(fixture.state.sendCalls,uncertainSends,'uncertain send cannot replay');
 for(const body of [{done:true},{recipient:'someone@example.test'}])await api(activation+'/test-mail',{body,status:400});await api(activation+'/check',{body:{done:true},status:400});
 const serialized=JSON.stringify(await api(activation));assert.doesNotMatch(serialized,/activation-inert-(?:model|mail)-key|activation-inert-inbound-token/,'no secrets in response');
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await page.goto(`${runtime.origin}/projects/${projectId}/activation`);await page.locator('[data-step="owner_mail"][data-state="unknown"]').waitFor();await noOverflow(page,'provider observation states');await axeChecklist(page,evidence,`${width}-provider-states`);await capture(page,evidence,`${width}-provider-states`,artifacts);}
 assert.equal(fixture.state.error,undefined,'HTTP fixture received only expected requests');assert.ok(fixture.state.calls.every(call=>call.method==='GET'||call.url==='https://api.resend.com/emails'),'no model generation or unexpected remote effect');
 checks.push('actual provider HTTP boundary: invalid/revoked model, permission/schema negatives, DNS pending/failed/verified, real authenticated inbound, queue vs bounce/delivery, idempotent and uncertain mail; secrets absent');
}
