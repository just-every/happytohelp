import test from 'node:test'
import assert from 'node:assert/strict'
import { notFoundResponse } from '../src/base/rejected-response.ts'
const request=body=>new Request('https://example.test/absent',{method:'POST',body,duplex:'half'})
test('unknown request drains finite input and preserves 404',async()=>{
 let pulls=0
 const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(32));if(pulls===3)controller.close()}})
 const response=await notFoundResponse(request(stream))
 assert.equal(response.status,404)
 assert.equal(pulls,3)
})
test('unknown request cancels oversized upload without buffering it',async()=>{
 let cancelled=false
 const response=await notFoundResponse(request(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(65537))},cancel(){cancelled=true}})))
 assert.equal(response.status,413)
 assert.equal(cancelled,true)
})
test('unknown request cancels a stalled upload at its deadline',async()=>{
 let cancelled=false
 const response=await notFoundResponse(request(new ReadableStream({cancel(){cancelled=true}})))
 assert.equal(response.status,408)
 assert.equal(cancelled,true)
})
