import assert from 'node:assert/strict';
import {generate} from '../move-in/generator.mjs';

export async function seedPortableData(origin,projectId,token,json){
 const project=await json(`/api/identity/projects/${projectId}`,undefined,token);
 const visitor=await json('/api/identity/widget/session',{widgetKey:project.widget_key,name:'Erase archive contact',email:'erase-archive@example.test'});
 const conversation=await json('/api/conversations',{projectId},visitor.token);
 await json(`/api/conversations/${conversation.id}/messages`,{localId:'archive-erasure',content:'Erase this message before backup',expectedRevision:0},visitor.token);
 await json(`/api/management/projects/${projectId}/contacts/${visitor.contactId}/erase`,{},token);
 const kept=await json('/api/identity/widget/session',{widgetKey:project.widget_key,name:'Retained archive contact'});
 const retained=await json('/api/conversations',{projectId},kept.token);
 const bytes=Uint8Array.from([0,255,128,42,13,10]);
 const upload=await fetch(origin+`/api/conversations/${retained.id}/media`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-Filename':'retained.bin'},body:bytes});assert.equal(upload.status,201);const media=await upload.json();
 const base=`/api/move-in/projects/${projectId}/imports`;
 const response=await fetch(origin+base+'?vendor=helpscout',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-Import-Filename':'archive-history.jsonl'},body:generate('helpscout',1)});assert.equal(response.status,201);let run=(await response.json()).data;
 const wait=async state=>{for(let i=0;i<240;i++){run=(await json(base+'/'+run.id,undefined,token)).data;if(run.state===state)return;assert.equal(run.error,null);await new Promise(resolve=>setTimeout(resolve,250))}assert.fail(`Import did not reach ${state}`)};
 await wait('ready');await json(base+'/'+run.id+'/apply',{fingerprint:run.plan.fingerprint},token);await wait('completed');
 return {projectId,erasedContactId:visitor.contactId,conversationId:retained.id,mediaId:media.id,bytes:[...bytes],runId:run.id};
}
export async function verifyPortableData(origin,state,token,json){
 const contact=(await json(`/api/management/projects/${state.projectId}/contacts/${state.erasedContactId}`,undefined,token)).data;
 assert.equal(contact.email,null);assert.equal(JSON.parse(contact.metadata_json).is_erased,1);
 const run=(await json(`/api/move-in/projects/${state.projectId}/imports/${state.runId}`,undefined,token)).data;assert.equal(run.state,'completed');
 const response=await fetch(origin+`/api/conversations/${state.conversationId}/media/${state.mediaId}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status,200);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],state.bytes);
}
