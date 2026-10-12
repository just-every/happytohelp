import assert from 'node:assert/strict';
import test from 'node:test';
import {WidgetTransport} from '../../src/modules/widget/transport.js';
import {connectionFixture} from '../helpers/widget-connection-fixture.mjs';
import {contextHooks} from '../helpers/widget-context-hooks.mjs';

test('saved contact is hydrated into React memory on resumed session without cache or contact writes',async()=>{
 const fixture=connectionFixture();let hook;
 try{
  const base=fetch;
  globalThis.fetch=async(url,options)=>url.endsWith('/api/identity/widget/profile')?Response.json({contact:{id:'visitor',name:'Saved visitor',email:'saved@example.test',verified:false}}):base(url,options);
  const initial=new WidgetTransport({apiOrigin:'http://localhost:8787',widgetKey:'profile'});await initial.connect();initial.close();
  hook=await contextHooks({apiOrigin:'http://localhost:8787',widgetKey:'profile',contact:{},settings:{collector:{enabled:false}}});
  await hook.value.assertConnected();hook.flush();
  assert.deepEqual(hook.value.contact,{id:'visitor',name:'Saved visitor',email:'saved@example.test',verified:false});
  assert.equal(fixture.state.sessionCount,1);assert.equal(hook.value.conversationId,'conversation');
  for(const value of fixture.storage.values())assert.doesNotMatch(value,/saved@example|Saved visitor/);
  assert.equal(fixture.requests.filter(request=>request.url.endsWith('/widget-events')).length,0,'hydration never writes contact fields');
 }finally{hook?.close();fixture.restore();}
});

test('refused profile hydration fails visibly without a session event or identity replacement',async()=>{
 const fixture=connectionFixture(),events=[];let client;
 try{
  const base=fetch;globalThis.fetch=async(url,options)=>url.endsWith('/api/identity/widget/profile')?Response.json({error:'Not found'},{status:404}):base(url,options);
  client=new WidgetTransport({apiOrigin:'http://localhost:8787',widgetKey:'profile',onEvent:event=>events.push(event)});
  await assert.rejects(client.connect(),/Not found/);assert.equal(events.filter(event=>event.type==='session').length,0);assert.equal(fixture.state.sessionCount,1);
  assert.equal(fixture.requests.filter(request=>request.url.includes('/api/conversations')).length,0,'refused hydration cannot resolve or create a conversation');
  assert.equal(fixture.sockets.length,0);assert.equal(JSON.parse(fixture.storage.get(client.storageKey)).contactId,'visitor');
 }finally{client?.close();fixture.restore();}
});

test('changing widget authority retires previously hydrated private contact memory before a refused read',async()=>{
 const fixture=connectionFixture();let hook;
 try{
  const base=fetch;let profiles=0;
  globalThis.fetch=async(url,options)=>url.endsWith('/api/identity/widget/profile')?(++profiles===1?Response.json({contact:{id:'visitor',name:'Saved visitor',email:'saved@example.test',verified:false}}):Response.json({error:'Not found'},{status:404})):base(url,options);
  const context={apiOrigin:'http://localhost:8787',widgetKey:'first',contact:{},settings:{collector:{enabled:false}}};
  hook=await contextHooks(context);await hook.value.assertConnected();hook.flush();assert.equal(hook.value.contact.email,'saved@example.test');
  context.widgetKey='second';hook.value.setMessages([]);hook.flush();
  await assert.rejects(hook.value.assertConnected(),/Not found/);hook.flush();
  assert.deepEqual(hook.value.contact,{});assert.deepEqual(hook.value.contactAuth,{});assert.equal(hook.value.conversationId,null);
 }finally{hook?.close();fixture.restore();}
});
