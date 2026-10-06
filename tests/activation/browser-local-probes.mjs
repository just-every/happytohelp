import assert from 'node:assert/strict';
import {apiKit,snapshot} from './browser-kit.mjs';
export async function localProbes({runtime,page,projectId,token,activation,checks}){
 const api=apiKit(runtime,token),knowledge=`/api/knowledge/${projectId}`,management=`/api/management/projects/${projectId}`;
 const step=(data,id)=>data.steps.find(s=>s.id===id);
 const check=async id=>snapshot(await api(activation+'/check',{body:{step:id}}));
 const initial=snapshot(await api(activation));assert.equal(initial.done,0);assert.ok(initial.steps.every(s=>s.state==='not_checked'));
 // Installer-required origin and defaults are observations only after explicit checks.
 let data=await check('spend_ceilings');assert.equal(step(data,'spend_ceilings').state,'done');assert.match(step(data,'spend_ceilings').detail,/UTC|reset/i);
 data=await check('widget_origin');assert.equal(step(data,'widget_origin').state,'done');
 const observed=step(data,'widget_origin');assert.equal(step(snapshot(await api(activation)),'widget_origin').receiptRef,observed.receiptRef);
 await api(management+'/settings',{method:'PUT',body:{allowed_origin:'https://activation-changed.example.test'}});
 assert.notEqual(step(snapshot(await api(activation)),'widget_origin').state,'done','origin change invalidates observed receipt');
 await api(management+'/settings',{method:'PUT',body:{allowed_origin:runtime.origin}});await check('widget_origin');
 const draft=await api(knowledge+'/articles',{body:{title:'Activation draft',slug:'activation-draft',content:'A real draft source.',status:'draft'},status:201});
 assert.notEqual(step(await check('published_article'),'published_article').state,'done','draft does not qualify');
 await api(knowledge+'/articles',{body:{id:draft.id,title:'Activation published source',slug:'activation-draft',content:'A real published source.',status:'published'},status:201});
 data=await check('published_article');assert.equal(step(data,'published_article').state,'done');
 await page.reload();assert.equal(step(snapshot(await api(activation)),'published_article').state,'done','progress persists after reload');
 await api(knowledge+'/articles',{body:{id:draft.id,title:'Activation draft again',slug:'activation-draft',content:'Unpublished source.',status:'draft'},status:201});assert.notEqual(step(snapshot(await api(activation)),'published_article').state,'done','unpublish invalidates receipt');
 for(const id of ['owner_mail','sender_dns','inbound_address','model_key'])assert.notEqual(step(await check(id),id).state,'done',id+' missing provider is not success');
 assert.notEqual(step(await check('widget_seen'),'widget_seen').state,'done','no contact/ping is no observation');
 await api(activation,{auth:null,status:401});
 const other=await runtime.seedTenant({name:'Other activation tenant',email:'activation-other@example.test',allowedOrigin:runtime.origin});
 for(const suffix of ['','/check','/test-mail'])await api(activation+suffix,{auth:other.token,...(suffix?{body:{}}:{}),status:403});
 const owner=await api('/api/identity/session');
 await runtime.execute(`UPDATE memberships SET role='operator' WHERE project_id='${projectId}' AND user_id='${owner.id}'; UPDATE sessions SET role='operator' WHERE project_id='${projectId}' AND actor_id='${owner.id}';`);
 for(const suffix of ['','/check','/test-mail'])await api(activation+suffix,{...(suffix?{body:{}}:{}),status:403});
 await runtime.execute(`UPDATE memberships SET role='owner' WHERE project_id='${projectId}' AND user_id='${owner.id}'; UPDATE sessions SET role='owner' WHERE project_id='${projectId}' AND actor_id='${owner.id}';`);
 checks.push('durable local probes, stale origin/publication, missing providers, anonymous/cross-tenant/operator denial');
}
