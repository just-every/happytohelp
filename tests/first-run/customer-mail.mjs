import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {post} from './browser-kit.mjs';

/** Native widget admission and operator Send, with the real follow-up service. */
export async function captureCustomerReply(runtime,{projectId,token}){
 const {origin}=runtime;
 const projectResponse=await fetch(origin+'/api/identity/projects/'+projectId,{headers:{Authorization:'Bearer '+token}});
 assert.equal(projectResponse.status,200);const project=await projectResponse.json();
 const settings=await fetch(origin+'/api/management/projects/'+projectId+'/email-settings',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({from_name:'Local support',from_address:'support@localhost.test',is_enabled:true})});
 assert.equal(settings.status,200);
 const contact=await post(origin,'/api/identity/widget/session',{widgetKey:project.widget_key,email:'customer@example.test',name:'Local customer'});
 const conversation=await post(origin,'/api/conversations',{projectId},contact.token);
 const question=await post(origin,`/api/conversations/${conversation.id}/messages`,{localId:randomUUID(),content:'Please help with my local trial',expectedRevision:0},contact.token);
 assert.equal(question.accepted,true);
 const text='A reply captured for the local customer';
 const command={localId:randomUUID(),content:text,expectedRevision:1,expectedLastMessageId:question.message.id};
 const reply=await post(origin,`/api/conversations/${conversation.id}/messages`,command,token);assert.equal(reply.accepted,true);
 const duplicate=await post(origin,`/api/conversations/${conversation.id}/messages`,command,token);assert.equal(duplicate.duplicate,true);
 const deadline=Date.now()+30000;let captured=false;
 while(Date.now()<deadline){
  const html=await (await fetch(origin+'/__dev/outbox')).text();
  if(html.includes('Reply to your support conversation')&&html.includes('customer@example.test')){captured=true;break;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.equal(captured,true,'native operator reply reaches the persistent local outbox');
 return {conversationId:conversation.id,text};
}
