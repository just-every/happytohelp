import assert from 'node:assert/strict';
import WebSocket from 'ws';
/** Samples the application isolate, not the workerd process (which also owns D1).
 * No source bodies, runtime objects, credentials, or evaluated expressions leave it. */
export async function heapSampler(mf){
 const origin=await mf.getInspectorURL();origin.protocol='http:';const targets=await (await fetch(new URL('/json/list',origin))).json(),target=targets.find(row=>row.title?.includes('move-in-native'));
 assert.ok(target,'application isolate inspector target');
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject)});
 let sequence=0,peaks={},samples=0,pending=false,failed;
 const requests=new Map();socket.on('message',bytes=>{const message=JSON.parse(String(bytes)),wait=requests.get(message.id);if(wait){requests.delete(message.id);clearTimeout(wait.timer);message.error?wait.reject(new Error(message.error.message)):wait.resolve(message.result)}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{requests.delete(id);reject(new Error('Heap inspector timed out'))},30000);requests.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))});
 async function sample(){if(pending)return;pending=true;try{const heap=await send('Runtime.getHeapUsage');for(const [key,value] of Object.entries(heap))if(typeof value==='number'&&Number.isFinite(value))peaks[key]=Math.max(peaks[key]||0,value);samples++}catch(error){failed=error}finally{pending=false}}
 await sample();const timer=setInterval(sample,20);
 return {snapshot(){return {samples,peaks:{...peaks}}},async close(){clearInterval(timer);while(pending)await new Promise(resolve=>setTimeout(resolve,5));await sample();socket.terminate();if(failed)throw failed;assert.ok(samples>0);return {samples,peaks,unavailableFields:['usedSize','totalSize','embedderHeapUsedSize','backingStorageSize'].filter(key=>!(key in peaks)),sampleIntervalMs:20}}};
}
