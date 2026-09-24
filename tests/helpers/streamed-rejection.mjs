import assert from 'node:assert/strict';
import {request} from 'node:http';

// A legitimate chunked client finishes its input after the handler can already
// decide to reject it. The response must not end the upload's request lifetime.
export async function verifyStreamedRejection(url,token,body,status) {
 const serialized=JSON.stringify(body);
 const result=await new Promise((resolve,reject)=>{
  let inputEnded=false,timer;
  const req=request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}},response=>{
   const endedBeforeResponse=inputEnded;const chunks=[];
   response.on('data',chunk=>chunks.push(chunk));
   response.on('end',()=>{clearTimeout(timer);if(!inputEnded)req.destroy();resolve({status:response.statusCode,body:Buffer.concat(chunks).toString(),endedBeforeResponse});});
   response.on('error',reject);
  });
  req.on('error',error=>{clearTimeout(timer);reject(error);});
  req.write(serialized.slice(0,1));
  timer=setTimeout(()=>{inputEnded=true;req.end(serialized.slice(1));},200);
 });
 assert.equal(result.status,status,result.body);
 assert.equal(result.endedBeforeResponse,true,'early rejection returned before the client finished its request body');
 return result;
}
