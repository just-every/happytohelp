import {app} from '../../src/app'
import {raceDatabase} from '../connections/race-db'
export {ConversationSocket} from '../../src/modules/conversations/socket'

// Test-only interposition: the application and every query still run in workerd/D1.
export default {async fetch(request:Request,env:any,context:ExecutionContext){
 const url=new URL(request.url)
 if(url.pathname==='/_test/profile-race'){
  const input:any=await request.json()
  const database=raceDatabase(env.DB,input.commands,input.match)
  return app.fetch(new Request('https://app.example/api/identity/widget/profile',{headers:request.headers}),{...env,DB:database},context)
 }
 if(url.pathname==='/_test/collector-race'){
  const input:any=await request.json()
  const database=raceDatabase(env.DB,input.commands,'UPDATE contacts SET')
  const target=new Request('https://app.example/api/conversations/'+input.conversationId+'/widget-events',{
   method:'POST',headers:request.headers,body:JSON.stringify({action:'contact',data:input.data}),
  })
  return app.fetch(target,{...env,DB:database},context)
 }
 if(url.pathname==='/_test/profile-no-database'){
  let reads=0
  const response=await app.fetch(new Request('https://app.example/api/identity/widget/profile',{headers:request.headers}),{...env,DB:{prepare(){reads++;throw Error('Database access forbidden')}}},context)
  const headers=new Headers(response.headers);headers.set('X-Test-Database-Reads',String(reads))
  return new Response(response.body,{status:response.status,headers})
 }
 return app.fetch(request,env,context)
}}
