import assert from 'node:assert/strict'
import {createRuntime} from './helpers/emitted-runtime.mjs'
import {awaitWindowRoom} from './helpers/window-room.mjs'

// The built Worker with no limit configuration: the shipped defaults bound the public
// surface that the publication audit abused (40 spoofed-Origin sessions, 30 rapid messages).
const runtime=await createRuntime();let success=false
try{
 const {origin}=runtime,widgetOrigin='https://customer-site.example'
 const call=(path,body,token,headers={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
 const owner=await(await call('/api/identity/bootstrap',{password:'synthetic-test-setup-password-123',name:'Limits project',email:'limits-owner@example.com',allowedOrigin:widgetOrigin})).json()
 const project=await(await call('/api/identity/projects/'+owner.projectId,undefined,owner.token)).json()
 // Each burst must fall inside one UTC-aligned window of the limit it exercises.
 await awaitWindowRoom(3600,30000)
 const statuses=[],sessions=[]
 for(let index=0;index<40;index++){const response=await call('/api/identity/widget/session',{widgetKey:project.widget_key},undefined,{Origin:widgetOrigin});statuses.push(response.status);if(response.status===201)sessions.push(await response.json());else{assert.equal(response.status,429);const body=await response.json();assert.equal(body.limit,'widgetSessionsPerIpHour');assert.ok(Number(response.headers.get('Retry-After'))>=1);assert.equal(response.headers.get('Access-Control-Allow-Origin'),widgetOrigin);assert.match(response.headers.get('Access-Control-Expose-Headers')||'',/Retry-After/)}}
 assert.deepEqual(statuses,[...Array(30).fill(201),...Array(10).fill(429)])
 const visitor=sessions[0],conversation=await(await call('/api/conversations',{projectId:owner.projectId},visitor.token,{Origin:widgetOrigin})).json()
 await awaitWindowRoom(60,10000)
 const sent=[]
 for(let index=0;index<30;index++){const response=await call(`/api/conversations/${conversation.id}/messages`,{localId:'rapid-'+index,content:'Rapid message '+index,expectedRevision:sent.filter(status=>status===200).length},visitor.token,{Origin:widgetOrigin});sent.push(response.status);if(response.status===429){const body=await response.json();assert.equal(body.limit,'messagesPerConversationMinute');assert.ok(Number(response.headers.get('Retry-After'))<=60)}}
 assert.deepEqual(sent,[...Array(15).fill(200),...Array(15).fill(429)])
 const transcript=await(await call(`/api/conversations/${conversation.id}/messages`,undefined,visitor.token,{Origin:widgetOrigin})).json()
 assert.equal(transcript.messages.length,15,'refused messages are not stored')
 console.log('Emitted Worker default limits: 30 of 40 spoofed-Origin widget sessions and 15 of 30 rapid visitor messages admitted; the rest received 429 with Retry-After readable cross-origin.')
 success=true
}finally{await runtime.close(success)}
