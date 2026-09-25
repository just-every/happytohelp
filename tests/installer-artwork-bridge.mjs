import assert from 'node:assert/strict';
import {createArtworkBridge} from '../scripts/installer/artwork-bridge.mjs';
const originalFetch = globalThis.fetch;
const bytes = Buffer.from('real upload boundary fixture');
const item = {id:'sidebar',revision:1,context:{website:'https://example.org',name:'North & coast',primaryColor:'#713ee0'},bytes,isCurrent:() => true};
const auth = {origin:'http://127.0.0.1:1234',token:'private-owner-token',userId:'owner',projectId:'workspace'};
let calls, statuses, profile, mode, bridge, expectedContext;
function reset() {
 bridge?.close();calls=[];statuses=[];mode='ok';expectedContext=item.context;profile={...item.context,artwork_url:null,artwork_enabled:false};
 bridge=createArtworkBridge({onStatus:value=>statuses.push(value)});
}
globalThis.fetch=async (url,options) => {
 calls.push({url,options});assert.equal(options.headers.Authorization,`Bearer ${auth.token}`);assert.equal(options.redirect,'error');assert.ok(url.startsWith(auth.origin+'/api/management/projects/'+auth.projectId+'/'));
 if (url.endsWith('/appearance')) return Response.json({data:profile});
 if (options.method === 'PUT') {
  assert.deepEqual(options.body,bytes);assert.equal(options.headers['Content-Type'],'image/png');
  assert.equal(options.headers['x-h2h-expected-workspace'],encodeURIComponent(JSON.stringify(expectedContext)));assert.equal(options.headers['x-h2h-expected-artwork'],'none');
  if (mode === 'conflict') return new Response(null,{status:409});
  if (mode !== 'lost') profile.artwork_url='/api/management/projects/workspace/artwork/new';
  if (mode === 'lost' || mode === 'accepted-lost') throw Error('network failure with secrets must not escape');
  return Response.json({data:profile});
 }
 return new Response(bytes);
};
try {
 reset();await bridge.deliver(item);assert.equal(calls.length,0);assert.equal(statuses.at(-1).phase,'pending');await bridge.attach(auth);assert.equal(statuses.at(-1).phase,'applied');assert.equal(calls.length,2);
 await bridge.deliver(item);assert.equal(calls.length,2);assert.equal(statuses.at(-1).phase,'applied');assert.ok(!JSON.stringify(statuses).includes(auth.token));
 await assert.rejects(bridge.attach(auth),/already bound/);
 reset();await assert.rejects(bridge.attach({...auth,projectId:undefined}),/Invalid owner/);
 reset();await bridge.attach(auth);await bridge.deliver(item);assert.equal(statuses.at(-1).phase,'applied');
 reset();expectedContext={...item.context,primaryColor:'#1286ab'};profile={...profile,primaryColor:'#1286ab'};await bridge.deliver({...item,context:{...item.context,primaryColor:'#1286AB'}});await bridge.attach(auth);assert.equal(statuses.at(-1).phase,'applied');assert.equal(calls.filter(c=>c.options.method==='PUT').length,1);
 reset();await bridge.deliver({...item,isCurrent:()=>false});await bridge.attach(auth);assert.equal(calls.length,0);
 reset();await bridge.deliver(item);profile.website='https://changed.example.org';await bridge.attach(auth);assert.equal(statuses.at(-1).phase,'skipped');assert.equal(calls.length,1);
 for (const key of ['name','primaryColor']) {reset();await bridge.deliver(item);profile[key]='changed';await bridge.attach(auth);assert.equal(statuses.at(-1).phase,'skipped');assert.equal(calls.length,1);}
 reset();await bridge.deliver(item);profile.artwork_url='/api/management/projects/workspace/artwork/owner-choice';await bridge.attach(auth);assert.equal(statuses.at(-1).phase,'skipped');assert.equal(calls.length,1);
 reset();mode='conflict';await bridge.attach(auth);await bridge.deliver(item);assert.equal(statuses.at(-1).phase,'skipped');
 reset();mode='accepted-lost';await bridge.attach(auth);await bridge.deliver(item);assert.equal(statuses.at(-1).phase,'applied');assert.equal(calls.filter(c=>c.options.method==='PUT').length,1);
 reset();mode='lost';await bridge.attach(auth);await bridge.deliver(item);assert.equal(statuses.at(-1).phase,'unknown');await bridge.deliver(item);assert.equal(calls.filter(c=>c.options.method==='PUT').length,1);assert.ok(!JSON.stringify(statuses).includes('network failure'));
 reset();bridge.close();await bridge.deliver(item);assert.equal(calls.length,0);
 console.log('Installer artwork bridge: private owner binding, early/late delivery, stale/workspace edits, atomic conflict, uncertain reconciliation and no replay passed.');
} finally {bridge?.close();globalThis.fetch=originalFetch;}
