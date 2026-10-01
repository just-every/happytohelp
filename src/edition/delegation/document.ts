import {Hono} from 'hono'
import type {AppEnv,Env} from '../../platform/env'
import {requireActor} from '../../platform/auth'
const documents=/^\/delegation\/(?:authorize|settings)\/?$/
/** Connected applications and the consent screen are dashboard documents; every other /delegation request is a Hono form post or read. */
export function isDelegationDocument(request:Request){
 return (request.method==='GET'||request.method==='HEAD')&&documents.test(new URL(request.url).pathname)
}
// A request without a current session is sent to sign in before any page loads, as these pages always did.
const signedIn=new Hono<AppEnv>().all('*',async c=>{await requireActor(c);return c.body(null,204)})
export async function delegationLoginRedirect(request:Request,env:Env,execution?:ExecutionContext){
 if((await signedIn.fetch(request,env,execution)).status!==401)return null
 const url=new URL(request.url)
 return new Response(null,{status:303,headers:{Location:'/login?returnTo='+encodeURIComponent(url.pathname+url.search)}})
}
/** These documents grant or revoke access to project records: never cached, never framed. */
export function protectDelegationDocument(response:Response){
 const secured=new Response(response.body,response),policy=secured.headers.get('Content-Security-Policy')
 secured.headers.set('Cache-Control','no-store')
 secured.headers.set('Content-Security-Policy',policy&&!/(?:^|;)\s*frame-ancestors\s/i.test(policy)?`${policy}; frame-ancestors 'none'`:policy||"frame-ancestors 'none'")
 secured.headers.set('X-Frame-Options','DENY')
 return secured
}
