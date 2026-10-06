import assert from 'node:assert/strict';
import {apiKit,snapshot} from './browser-kit.mjs';
export async function widgetProbes({runtime,projectId,token,activation,checks}){
 const api=apiKit(runtime,token),project=await api(`/api/identity/projects/${projectId}`);
 const visitor=await api('/api/identity/widget/session',{body:{widgetKey:project.widget_key,name:'Activation visitor',email:'activation-visitor@example.test'},auth:null,headers:{Origin:runtime.origin},status:201});
 const conversation=await api('/api/conversations',{body:{projectId},auth:visitor.token,status:201});
 const widgetStep=async()=>snapshot(await api(activation+'/check',{body:{step:'widget_seen'}})).steps.find(s=>s.id==='widget_seen');
 assert.notEqual((await widgetStep()).state,'done','creating contact does not prove ping');
 await api(`/api/conversations/${conversation.id}/widget-events`,{auth:visitor.token,body:{action:'instruction',data:{opened:true}},headers:{Origin:runtime.origin}});
 assert.notEqual((await widgetStep()).state,'done','generic instruction/last_seen_at does not prove ping');
 await api(`/api/conversations/${conversation.id}/widget-events`,{auth:visitor.token,body:{action:'pingActive',data:{}},headers:{Origin:runtime.origin}});
 const seen=await widgetStep();assert.equal(seen.state,'done');assert.ok(seen.checkedAt);assert.ok(seen.receiptRef);
 await api(`/api/management/projects/${projectId}/settings`,{method:'PUT',body:{allowed_origin:'https://activation-second-origin.example.test'}});
 assert.notEqual(snapshot(await api(activation)).steps.find(s=>s.id==='widget_seen').state,'done','origin change invalidates old ping');
 checks.push('real widget identity/event endpoint distinguishes contact and instruction from accepted current-origin ping');
}
