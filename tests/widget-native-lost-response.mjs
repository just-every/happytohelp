import assert from 'node:assert/strict';
import {WidgetTransport} from '../src/modules/widget/transport.js';
// Run against an emitted local Worker with test-only project/origin fixtures.
const apiOrigin=process.env.WIDGET_TEST_API,widgetKey=process.env.WIDGET_TEST_KEY,origin=process.env.WIDGET_TEST_ORIGIN;
if(!apiOrigin||!widgetKey||!origin)throw new Error('WIDGET_TEST_API, WIDGET_TEST_KEY, WIDGET_TEST_ORIGIN required');
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
const nativeFetch=globalThis.fetch;
let dropResponse=true;
globalThis.fetch=async(url,options={})=>{
 const headers=new Headers(options.headers);headers.set('Origin',origin);
 const response=await nativeFetch(url,{...options,headers});
 if(dropResponse&&options.method==='POST'&&String(url).endsWith('/messages')&&response.ok){await response.clone().json();dropResponse=false;throw new TypeError('Test: connection lost after native D1 commit');}
 return response;
};
let connected;const ready=new Promise(resolve=>{connected=resolve});
const transport=new WidgetTransport({apiOrigin,widgetKey,onEvent:event=>{if(event.type==='connected')connected()}});
try{
 await transport.connect();await ready;await transport.refresh();
 const command={local_id:crypto.randomUUID(),content:'Lost-response native D1 proof',media_ids:[]};
 await assert.rejects(transport.send(command),/after native D1 commit/);
 const frozen=structuredClone(transport.session.pendingCommands[command.local_id]);
 await transport.refresh();assert.ok(transport.revision>frozen.expectedRevision);
 const result=await transport.send(command);assert.equal(result.accepted,true);assert.equal(result.duplicate,true);
 const transcript=await transport.refresh();assert.equal(transcript.messages.filter(message=>message.local_id===command.local_id).length,1);
 assert.equal(transport.session.pendingCommands[command.local_id],undefined);
 if(process.env.WIDGET_TEST_OWNER_TOKEN){
  const before=await transport.refresh();let interleaved=false;
  globalThis.fetch=async(url,options={})=>{
   const headers=new Headers(options.headers);headers.set('Origin',origin);
   if(!interleaved&&options.method==='POST'&&String(url).endsWith('/messages')){
    interleaved=true;
    const operator=await nativeFetch(url,{method:'POST',headers:{Authorization:`Bearer ${process.env.WIDGET_TEST_OWNER_TOKEN}`,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({localId:crypto.randomUUID(),content:'Concurrent operator reply',expectedRevision:before.revision,expectedLastMessageId:before.lastMessageId})});
    assert.equal(operator.status,200);
   }
   return nativeFetch(url,{...options,headers});
  };
  const concurrent={local_id:crypto.randomUUID(),content:'Concurrent visitor message',media_ids:[]};
  assert.equal((await transport.send(concurrent)).accepted,true);
  const after=await transport.refresh();assert.equal(after.revision,before.revision+2);assert.equal(after.messages.filter(m=>m.local_id===concurrent.local_id).length,1);assert.equal(transport.session.pendingCommands[concurrent.local_id],undefined);
  console.log('Actual D1 concurrent operator/contact: definitive rejection, refreshed frontier, single accepted visitor message passed');
 }
 console.log('Actual widget transport → emitted Worker → D1 lost-response retry: immutable frontier/local identity, duplicate receipt, one durable message passed');
}finally{transport.close();globalThis.fetch=nativeFetch;}
