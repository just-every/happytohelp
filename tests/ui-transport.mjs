import assert from 'node:assert/strict';
import test from 'node:test';
import {sendCommand,connectConversation} from '../src/ui/native/transport.js';

test('operator message uses durable frontier and retains command identity; conflict is surfaced without retry',async()=>{
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init={})=>{calls.push({url,init});return calls.length===1?Response.json({revision:7,lastMessageId:'m7'}):Response.json({error:'Conversation changed'},{status:409})};
 try{await assert.rejects(sendCommand('p','c','sendMessage',{local_id:'stable-command',content:'reply',media_ids:['media']}),/Conversation changed/);assert.equal(calls.length,2);assert.deepEqual(JSON.parse(calls[1].init.body),{localId:'stable-command',content:'reply',expectedRevision:7,expectedLastMessageId:'m7',mediaIds:['media']});}finally{globalThis.fetch=previous;}
});

test('socket cursor advances only after frame handler succeeds; disposal cannot reconnect or issue commands',()=>{
 const originals={WebSocket:globalThis.WebSocket,location:globalThis.location,window:globalThis.window,sessionStorage:globalThis.sessionStorage};
 const storage=new Map();const sockets=[];const errors=[];
 globalThis.location={origin:'https://support.example',protocol:'https:'};globalThis.window={chatSettings:{}};globalThis.sessionStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 globalThis.WebSocket=class{constructor(url){this.url=url;sockets.push(this)}close(){this.closed=true;this.onclose?.()}};
 try{const stop=connectConversation('c',frame=>{if(frame.eventId==='bad')throw new Error('invalid frame')},()=>{},error=>errors.push(error));sockets[0].onmessage({data:JSON.stringify({type:'message',eventId:'e1'})});assert.equal(storage.get('h2h-event:c'),'e1');sockets[0].onmessage({data:JSON.stringify({type:'message',eventId:'bad'})});assert.equal(storage.get('h2h-event:c'),'e1');assert.equal(errors.length,1);stop();assert.equal(sockets[0].closed,true);assert.equal(sockets.length,1);}finally{Object.assign(globalThis,originals);}
});
