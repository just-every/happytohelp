import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {WidgetTransport} from '../src/modules/widget/transport.js';
const originalFetch = globalThis.fetch;
const originalSocket = globalThis.WebSocket;
const originalStorage = globalThis.localStorage;
let requests, sockets, events;
beforeEach(() => {
  requests = []; sockets = []; events = [];
  const storage = new Map();
  globalThis.localStorage = {getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value)};
  globalThis.WebSocket = class {constructor(url) {this.url = url; sockets.push(this);} close() {this.onclose?.();}};
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url, options});
    if (url.endsWith('/widget/session')) return Response.json({token:'contact-token', contactId:'visitor',projectId:'project'});
    if (url.endsWith('/api/conversations')) return Response.json(options.method === 'POST' ? {id:'conversation'} : {conversations:[]});
    if (url.endsWith('/messages') && options.method === 'POST') return Response.json({accepted:true, message: {id:'message',local_id:JSON.parse(options.body).localId,content:'hello',actor_role:'contact',created_at:0}});
    if (url.endsWith('/messages')) return Response.json({messages:[], revision:3,lastMessageId:'frontier'});
    return Response.json({});
  };
});
afterEach(() => {globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; globalThis.localStorage = originalStorage;});
const client = key => new WidgetTransport({apiOrigin:'http://localhost:8779', widgetKey:key, onEvent:event => events.push(event)});
test('refuses insecure remote endpoints and missing public widget identity', () => {
  assert.throws(() => new WidgetTransport({apiOrigin:'http://example.com', widgetKey:'p'}), /HTTPS/);
  assert.throws(() => new WidgetTransport({apiOrigin:'https://example.com'}), /widgetKey/);
});
test('reload resumes scoped contact and conversation without creating a replacement visitor', async () => {
  const first = client('one'); await first.connect(); first.close();
  const second = client('one'); await second.connect(); second.close();
  assert.equal(requests.filter(r => r.url.endsWith('/widget/session')).length, 1);
  assert.equal(requests.filter(r => r.url.endsWith('/api/conversations') && r.options.method === 'POST').length, 1);
  assert.equal(second.session.contactId,'visitor');
  const third = client('two'); await third.connect(); third.close();
  assert.equal(requests.filter(r => r.url.endsWith('/widget/session')).length, 2);
});
test('message command carries real frontier and stable identity with contact bearer only', async () => {
  const transport = client('one');
  await transport.send({local_id:'local-command', content:'hello', media_ids:['media']});
  const command = requests.find(r => r.url.endsWith('/messages') && r.options.method === 'POST');
  assert.deepEqual(JSON.parse(command.options.body), {localId:'local-command',content:'hello',expectedRevision:3,expectedLastMessageId:'frontier',mediaIds:['media']});
  assert.equal(command.options.headers.get('Authorization'),'Bearer contact-token');
  assert.equal(events.find(event => event.type === 'message').message.contact_id,'visitor');
  transport.close();
});
test('socket replay deduplicates outbox events and ignores replaced sockets', async () => {
  const transport = client('one'); await transport.connect();
  const socket = sockets[0];
  const event = {data:JSON.stringify({type:'message',eventId:6,message:{id:'six',actor_role:'owner',actor_id:'operator',created_at:1720000000000}})};
  await socket.onmessage(event); await socket.onmessage(event);
  assert.equal(events.filter(e => e.type === 'message').length,1);
  assert.equal(events.find(e => e.type === 'message').message.agent_id,'operator');
  transport.openSocket();
  assert.match(sockets[1].url.toString(), /after=6/);
  await socket.onmessage({data:JSON.stringify({type:'message',eventId:7,message:{id:'old'}})});
  assert.equal(events.filter(e => e.type === 'message').length,1);
  transport.close();
});
test('expired persisted session fails visibly without silently discarding identity', async () => {
  const transport = client('one');
  localStorage.setItem(transport.storageKey, JSON.stringify({token:'expired',contactId:'visitor',projectId:'project',conversationId:'conversation'}));
  globalThis.fetch = async () => Response.json({message:'Session invalid or expired'}, {status:401});
  await assert.rejects(transport.connect(), /Session invalid or expired/);
  assert.equal(JSON.parse(localStorage.getItem(transport.storageKey)).token, 'expired');
  transport.close();
});
test('verified identity change obtains a signed session and resumes its existing conversation', async () => {
  const transport = client('one');
  localStorage.setItem(transport.storageKey, JSON.stringify({token:'anonymous',contactId:'anonymous',projectId:'project',conversationId:'old'}));
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url,options});
    if (url.endsWith('/widget/session')) return Response.json({token:'verified-token',contactId:'known',projectId:'project',verified:true});
    if (url.endsWith('/api/conversations')) return Response.json({conversations:[{id:'existing-known-conversation'}]});
    if (url.endsWith('/messages')) return Response.json({messages:[],revision:0,lastMessageId:null});
    return Response.json({});
  };
  await transport.connect({identifier:'customer-17',hash:'signed-hash'});
  assert.equal(transport.session.contactId,'known');
  assert.equal(transport.conversationId,'existing-known-conversation');
  assert.equal(transport.session.verifiedIdentity,'customer-17');
  const session = requests.find(r => r.url.endsWith('/widget/session'));
  const sessionBody=JSON.parse(session.options.body);
  assert.equal(sessionBody.contact_hash,'signed-hash');
  assert.equal(sessionBody.timezone,Intl.DateTimeFormat().resolvedOptions().timeZone);
  if(typeof navigator!=='undefined')assert.equal(sessionBody.language,navigator.language);
  for(const key of ['ip_address','country_code','user_agent'])assert.equal(key in sessionBody,false);
  await transport.action('pingActive',{timezone:'Forged/Zone',language:'forged',opened:true,ip_address:'forged',country_code:'ZZ',user_agent:'forged'});
  const presence=JSON.parse(requests.find(r=>r.url.endsWith('/widget-events')).options.body);
  assert.equal(presence.data.timezone,sessionBody.timezone);assert.equal(presence.data.language,sessionBody.language);assert.equal(presence.data.opened,true);
  for(const key of ['ip_address','country_code','user_agent'])assert.equal(key in presence.data,false);
  assert.equal(requests.filter(r => r.url.endsWith('/api/conversations') && r.options.method === 'POST').length,0);
  transport.close();
});
test('revocation stops reconnect and surfaces a session error', async () => {
  const failures=[],transport=new WidgetTransport({apiOrigin:'http://localhost:8779',widgetKey:'one',onError:error=>failures.push(error.message)});
  await transport.connect();sockets[0].onclose({code:1008});
  assert.deepEqual(failures,['Conversation session was revoked']);assert.equal(transport.timer,undefined);transport.close();
});
test('definitive stale-frontier rejection rebuilds once and does not poison pending replay', async () => {
 const transport=client('one');await transport.connect();let writes=0,revision=3;
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  if(url.endsWith('/messages')&&options.method==='POST'){
   const command=JSON.parse(options.body);writes++;
   if(writes===1){revision=4;return Response.json({accepted:false,reason:'conversation_changed_or_admission_denied'},{status:409});}
   assert.equal(command.expectedRevision,4);return Response.json({accepted:true,message:{id:'sent',local_id:command.localId,content:command.content,actor_role:'contact'}});
  }
  if(url.endsWith('/messages'))return Response.json({messages:[],revision,lastMessageId:'operator-frontier'});
  return previous(url,options);
 };
 const result=await transport.send({local_id:'concurrent',content:'visitor message'});assert.equal(result.accepted,true);assert.equal(writes,2);assert.equal(transport.session.pendingCommands.concurrent,undefined);transport.close();
});
