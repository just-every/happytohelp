import type {Env} from './env'

/** Keep provider health/API doors reachable while browser entry uses the public address. */
export function canonicalNavigation(request:Request,env:Env):Response|null {
 const url=new URL(request.url)
 if(!['GET','HEAD'].includes(request.method)||!request.headers.get('Accept')?.includes('text/html')||!url.hostname.endsWith('.workers.dev')||typeof env.APP_ORIGIN!=='string')return null
 if(url.pathname==='/health'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return null
 const canonical=new URL(env.APP_ORIGIN)
 if(url.origin===canonical.origin)return null
 return Response.redirect(new URL(url.pathname+url.search,canonical),307)
}
