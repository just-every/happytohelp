import {test} from 'node:test';
import assert from 'node:assert/strict';
// Node's TypeScript stripping requires explicit local extension in the source bundle.
import {build} from 'vite';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temporary = await mkdtemp(join(tmpdir(),'h2h-plugin-sdk-'));
await build({configFile:false,publicDir:false,logLevel:'silent',build:{outDir:temporary,lib:{entry:'src/modules/plugin-sdk/index.ts',formats:['es'],fileName:()=> 'sdk.mjs'}}});
const {createPluginClient} = await import(join(temporary,'sdk.mjs'));
function scope() {const listeners=new Set(),sent=[];const parent={postMessage:(message,origin)=>sent.push({message,origin})};return {parent,sent,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),dispatch:event=>{for(const fn of listeners)fn(event)},listeners};}
test('outbound commands target configured host exactly and validate payload bounds',()=>{
 const window=scope(),client=createPluginClient({hostOrigin:'https://support.example',window});
 client.setMessageContent('draft');client.getConversation();client.resolveConversation('convo');client.setHeight('200px');
 assert.equal(window.sent.length,4);assert.ok(window.sent.every(frame=>frame.origin==='https://support.example'));
 assert.throws(()=>client.setHeight('100%'),/Invalid/);assert.throws(()=>client.setHeight(9000),/Invalid/);
 assert.throws(()=>createPluginClient({hostOrigin:'https://support.example/path',window}),/exact/);
 client.destroy();assert.equal(window.listeners.size,0);
});
test('host events require exact origin and actual parent window',()=>{
 const window=scope(),client=createPluginClient({hostOrigin:'https://support.example',window});let calls=0;
 client.on('setConversation',()=>calls++);
 const data={happytohelp:true,type:'setConversation',payload:{id:'conversation'}};
 window.dispatch({origin:'https://support.example.attacker.test',source:window.parent,data});
 window.dispatch({origin:'https://support.example',source:{},data});
 window.dispatch({origin:'https://support.example',source:window.parent,data});
 assert.equal(calls,1);client.destroy();
});
await build({configFile:false,publicDir:false,logLevel:'silent',build:{outDir:temporary,emptyOutDir:false,lib:{entry:'src/modules/plugin-sdk/host.ts',formats:['es'],fileName:()=> 'host.mjs'}}});
const {connectPluginHost} = await import(join(temporary,'host.mjs'));
test('host scopes incoming commands to configured iframe and sends exact-origin replies', async()=>{
 const window=scope(),sent=[],child={postMessage:(message,origin)=>sent.push({message,origin})},iframe={contentWindow:child,style:{}};let draft='';
 const host=connectPluginHost({iframe,pluginOrigin:'https://plugin.example',window,handlers:{setMessageContent:value=>{draft=value},getConversation:()=>({id:'active'}),resolveConversation:()=>{}}});
 window.dispatch({origin:'https://plugin.example.attacker.test',source:child,data:{happytohelp:true,type:'setMessageContent',payload:'bad'}});
 window.dispatch({origin:'https://plugin.example',source:{},data:{happytohelp:true,type:'setMessageContent',payload:'bad'}});
 assert.equal(draft,'');
 window.dispatch({origin:'https://plugin.example',source:child,data:{happytohelp:true,type:'setMessageContent',payload:'real draft'}});
 window.dispatch({origin:'https://plugin.example',source:child,data:{happytohelp:true,type:'getConversation'}});
 window.dispatch({origin:'https://plugin.example',source:child,data:{happytohelp:true,type:'setHeight',payload:'250px'}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(draft,'real draft');assert.equal(iframe.style.height,'250px');
 assert.deepEqual(sent,[{message:{happytohelp:true,type:'setConversation',payload:{id:'active'}},origin:'https://plugin.example'}]);
 host.destroy();assert.equal(window.listeners.size,0);
});
