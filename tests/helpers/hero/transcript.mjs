import assert from 'node:assert/strict';
import {get} from 'node:http';

// Connection: close still leaves the installed Playwright agent reusing sockets
// against native workerd. Disable pooling itself: one socket and one attempt per
// read, with the same 30-second bound as APIRequestContext's default.
export async function readTranscript(origin,session){
 const response=await new Promise((resolve,reject)=>{
  const request=get(origin+`/api/conversations/${session.conversationId}/messages`,{agent:false,signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${session.token}`}},result=>{
   const chunks=[];result.on('data',chunk=>chunks.push(chunk));result.on('error',reject);
   result.on('end',()=>resolve({status:result.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
  });
  request.on('error',reject);
 });
 assert.equal(response.status,200);
 return JSON.parse(response.body).messages;
}
