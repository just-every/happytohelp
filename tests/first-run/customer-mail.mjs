import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {post} from './browser-kit.mjs';

/** Native widget admission and operator Send, with the real follow-up service. */
export async function checkCustomerReply(runtime,{projectId,token}){
 const {origin}=runtime;
 const projectResponse=await fetch(origin+'/api/identity/projects/'+projectId,{headers:{Authorization:'Bearer '+token}});
 assert.equal(projectResponse.status,200);const project=await projectResponse.json();
 const settings=await fetch(origin+'/api/management/projects/'+projectId+'/email-settings',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({from_name:'Local support',from_address:'support@localhost.test',is_enabled:true})});
 assert.equal(settings.status,200);
 const contact=await post(origin,'/api/identity/widget/session',{widgetKey:project.widget_key,email:'customer@example.test',name:'Local customer'});
 const conversation=await post(origin,'/api/conversations',{projectId},contact.token);
 const question=await post(origin,`/api/conversations/${conversation.id}/messages`,{localId:randomUUID(),content:'Please help with my local trial',expectedRevision:0},contact.token);
 assert.equal(question.accepted,true);
 const text='A local customer reply';
 const command={localId:randomUUID(),content:text,expectedRevision:1,expectedLastMessageId:question.message.id};
 const reply=await post(origin,`/api/conversations/${conversation.id}/messages`,command,token);assert.equal(reply.accepted,true);
 const duplicate=await post(origin,`/api/conversations/${conversation.id}/messages`,command,token);assert.equal(duplicate.duplicate,true);
 const response=await fetch(origin+`/api/dashboard/projects/${projectId}/conversations/${conversation.id}/buckets/${conversation.id}`,{headers:{Authorization:'Bearer '+token}});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.ok(data.data.messages.some(row=>row.content===text&&row.email_status?.state==='suppressed'));
}
