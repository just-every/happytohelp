import type {Env} from '../../platform/env'
import {loginDestination} from '../../platform/dashboard-path.js'

/** The ordinary password form uses the same native admission path before JS loads. */
export async function loginDocument(request:Request,env:Env,send:(request:Request)=>Response|Promise<Response>):Promise<Response|null>{
 const url=new URL(request.url)
 if(url.pathname!=='/login'||request.method!=='POST')return null
 const headers={'Cache-Control':'no-store','Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer'}
 const denied=(status:number)=>new Response('<!doctype html><html lang="en"><title>Sign-in failed</title><p>Sign-in could not be completed. <a href="/login">Try again</a>.</p></html>',{status,headers})
 const origin=typeof env.APP_ORIGIN==='string'?env.APP_ORIGIN:url.origin
 if(request.headers.get('origin')!==url.origin||url.origin!==new URL(origin).origin||request.headers.get('sec-fetch-site')==='cross-site')return denied(403)
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return denied(415)
 if(Number(request.headers.get('content-length'))>8192){await request.body?.cancel();return denied(413)}
 const reader=request.body?.getReader(),decoder=new TextDecoder('utf-8',{fatal:true})
 let input='',size=0
 try{
  if(reader)while(true){
   const {done,value}=await reader.read();if(done)break
   size+=value.byteLength
   if(size>8192){await reader.cancel();return denied(413)}
   input+=decoder.decode(value,{stream:true})
  }
  input+=decoder.decode()
 }catch{await reader?.cancel().catch(()=>{});return denied(400)}finally{reader?.releaseLock()}
 const form=new URLSearchParams(input),forward=new Headers(request.headers)
 forward.set('Content-Type','application/json');forward.delete('Content-Length')
 const response=await send(new Request(new URL('/api/identity/login',url),{method:'POST',headers:forward,body:JSON.stringify({email:form.get('email'),password:form.get('password')})}))
 if(!response.ok){await response.body?.cancel();return denied(response.status)}
 const result=await response.json() as {accountOnly:boolean;twoFactor?:'verify'|'enrol'}
 const destination=loginDestination(url.searchParams.get('returnTo'),url.origin,result.accountOnly)
 // A sign-in that still needs its second factor continues on the two-factor page.
 const redirect=new Headers(headers);redirect.set('Location',result.twoFactor?`/two-factor?returnTo=${encodeURIComponent(destination)}`:destination)
 const cookie=response.headers.get('Set-Cookie');if(cookie)redirect.set('Set-Cookie',cookie)
 return new Response(null,{status:303,headers:redirect})
}
