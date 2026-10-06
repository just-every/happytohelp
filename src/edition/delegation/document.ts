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

/**
 * Content-Security-Policy for the two delegation documents. They are app pages: the TanStack Start
 * document hydrates with its own inline bootstrap script and the shell injects styles, so scripts and
 * styles allow 'unsafe-inline', but everything else is same-origin, plugins and a rebased document are
 * refused, and a form can only post back to this origin. Approving ends in a redirect to the
 * application's callback, which browsers also check against form-action, so the consent page alone
 * adds the origin of the callback registered for the request's client (never the unchecked query value).
 */
export async function delegationDocumentPolicy(request:Request,env:Env){
 const url=new URL(request.url),formAction=["'self'"]
 if(/^\/delegation\/authorize\/?$/.test(url.pathname)){
  const callback=url.searchParams.get('redirect_uri'),client=url.searchParams.get('client_id'),project=url.searchParams.get('account_id')
  if(callback&&client&&project){
   const row=await env.DB.prepare('SELECT redirect_uri FROM edition_clients WHERE id=? AND project_id=? AND enabled=1').bind(client.slice(0,200),project.slice(0,200)).first<{redirect_uri:string}>()
   if(row?.redirect_uri===callback){const origin=new URL(callback);if(origin.protocol==='https:'||origin.protocol==='http:')formAction.push(origin.origin)}
  }
 }
 return ["default-src 'self'","script-src 'self' 'unsafe-inline'","style-src 'self' 'unsafe-inline'","img-src 'self' data:","font-src 'self' data:","connect-src 'self'","object-src 'none'","base-uri 'self'","form-action "+formAction.join(' ')].join('; ')
}
/** Serve a delegation document: sign-in first, then the app page under its policy, never cached or framed. */
export async function delegationDocument(request:Request,env:Env,execution:ExecutionContext|undefined,render:()=>Promise<Response>){
 const redirect=await delegationLoginRedirect(request,env,execution)
 if(redirect)return protectDelegationDocument(redirect)
 const response=await render(),page=new Response(response.body,response)
 page.headers.set('Content-Security-Policy',await delegationDocumentPolicy(request,env))
 return protectDelegationDocument(page)
}
