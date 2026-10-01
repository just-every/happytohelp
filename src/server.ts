import start from '@tanstack/react-start/server-entry'
import type { Env,Job } from './platform/env'
import { app } from './app'
import { consumeJob, runScheduled } from './jobs'
import { dispatch } from './base/dispatch'
import { publicSiteRoutes,isPublicSitePath } from './modules/public-site'
import { handleEmail } from './modules/integrations'
import { headerSurface,withSecurityHeaders } from './platform/security-headers'
import { delegationLoginRedirect,isDelegationDocument,protectDelegationDocument } from './edition/delegation/document'
export { ConversationSocket } from './modules/conversations/socket'
async function route(request:Request,env:Env,execution:ExecutionContext,path:string,publicSite:boolean):Promise<Response>{
 if (import.meta.env.DEV && import.meta.env.H2H_LOCAL_OWNER_LOGIN && path === '/api/identity/local-owner-session') {
  const { localOwnerLogin } = await import('./development/local-owner-login');
  return localOwnerLogin.fetch(request,env,execution);
 }
 if(isDelegationDocument(request))return protectDelegationDocument(await delegationLoginRedirect(request,env,execution)??await start.fetch(request));if(path.startsWith('/delegation/'))return app.fetch(request,env,execution);if(path.startsWith('/preview/'))return app.fetch(request,env,execution);if(publicSite)return publicSiteRoutes.fetch(request,env,execution);return dispatch(request,()=>app.fetch(request,env,execution),()=>start.fetch(request))
}
export default {
 async fetch(request:Request,env:Env,execution:ExecutionContext){const path=new URL(request.url).pathname,publicSite=!path.startsWith('/preview/')&&await isPublicSitePath(path,env);
 return withSecurityHeaders(await route(request,env,execution,path,publicSite),headerSurface(path,publicSite),env)},
 async queue(batch:MessageBatch<Job>,env:Env){for(const message of batch.messages){try{await consumeJob(message.body,env);message.ack()}catch(error){console.error('Persisted job handler failed',message.body.type,message.body.id);message.retry()}}},
 async scheduled(_event:ScheduledController,env:Env){await runScheduled(env)},
 email:handleEmail,
} satisfies ExportedHandler<Env,Job>
