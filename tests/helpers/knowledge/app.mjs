import assert from 'node:assert/strict'
import {startApp} from '../../journeys/kit/app.mjs'

// The real application with captured queue work and a swappable provider network.
// `provider(request,entry)` answers outbound calls; unset, any outbound call fails.
export async function knowledgeApp({bindings={}}={}){
 let provider
 const app=await startApp({captureQueue:true,bindings,outbound:(request,entry)=>{if(!provider)throw new Error('Unexpected provider request '+request.url);return provider(request,entry)}})
 const owner=await app.seedWorkspace('p',{allowedOrigin:'https://example.com'}),other=await app.seedWorkspace('other',{allowedOrigin:'https://other.example.com'})
 const p=owner.projectId,token=owner.tokens.owner
 const call=(path,options={})=>app.call(path,{token,...options})
 // Run captured work like a queue: each job once (or twice, as an at-least-once redelivery), until none remain.
 const drain=async({twice=false,limit=500,headers}={})=>{let ran=0;for(;;){const jobs=await app.takeJobs();if(!jobs.length)return ran;for(const job of jobs){if(++ran>limit)throw new Error('knowledge work did not settle');await app.runJobs([job],headers);if(twice)await app.runJobs([job],headers)}}}
 const search=async(query,mode='lexical',project=p)=>{const result=await app.call(`/api/knowledge/${project}/search?`+new URLSearchParams({q:query,mode}),{token:project===p?token:other.tokens.owner});assert.equal(result.status,200,JSON.stringify(result.data));return result.data.citations}
 const dataset=async(name,project=p)=>(await call(`/api/knowledge/${project}/datasets`,{body:{name},status:201})).data.id
 return {app,p,other:other.projectId,owner,token,call,drain,search,dataset,set provider(value){provider=value},close:()=>app.close()}
}
