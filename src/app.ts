import {api as scopedApi} from './modules/api-integrations/routes'
import {integrationSettings} from './modules/api-integrations/settings'
import { notFoundResponse, rejectedResponse } from './base/rejected-response'
import { deploymentHealth } from './base/deployment-health'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from './platform/env'
import { projectCors } from './platform/cors'
import { routes as identity } from './modules/identity/routes'
import { visitorProfileCredential } from './modules/identity/widget-profile'
import { createConversationRoutes,projectSocketRoutes } from './modules/conversations/routes'
import { routes as ai } from './modules/ai-support/routes'
import { routes as knowledge } from './modules/knowledge'
import { routes as context } from './modules/customer-context'
import { registerLocalComputerRoutes } from './modules/local-computer'
import { localComputerIntegration } from './edition/local-computer'
import { trainingRoutes } from './modules/training-runs'
import { routes as management,dashboardRoutes,publicWidget,widgetEvents } from './modules/management'
import { inboundEmail } from './modules/integrations'
import { applyMessageEffects } from './message-effects'
import { routes as sitePreview,brandMediaRoutes } from './modules/site-preview/routes'
import {moveInRoutes} from './modules/move-in/routes'
import {tags} from './modules/management/tags'
import { previewRoutes } from './modules/site-preview/proxy'

import {delegation} from './edition/delegation/routes'
import {consent} from './edition/delegation/consent'
import {nativeDelegation} from './edition/delegation/launch'

export const app = new Hono<AppEnv>()
app.use('/api/*',async(c,next)=>{
 const origin=new URL(c.req.url);
 // A configured canonical origin wins; otherwise capture the actual app URL for queued work.
 if(!c.env.APP_ORIGIN)c.env={...c.env,APP_ORIGIN:origin.origin,H2H_LOCAL:undefined};
 await next();
})
// The bearer-only API never enters native cookie/project CORS, including errors.
app.route('/api/v1',scopedApi)
app.use('/api/identity/widget/profile',visitorProfileCredential)
app.use('/api/*',async(c,next)=>{if(c.req.path==='/api/v1'||c.req.path.startsWith('/api/v1/'))return next();return projectCors(c,next)})
app.onError((error,c) => {
 // An exception carrying its own response (e.g. 429 with Retry-After) keeps its headers and JSON body.
 if(error instanceof HTTPException) return rejectedResponse(c.req.raw,error.res?error.getResponse():c.json({error:error.message},error.status))
 const status=(error as Error & {status?:number}).status
 if(status && [400,401,403,404,409,413,422,429,503].includes(status)) return rejectedResponse(c.req.raw,c.json({error:error.message},status as 400))
 console.error('Request failed',error.name)
 return rejectedResponse(c.req.raw,c.json({error:'Request failed. Check server diagnostics.'},500))
})
app.get('/health',async c=>{
 try { await Promise.all([c.env.DB.prepare('SELECT 1').first(),c.env.FILES.head('_health_probe')]);return c.json({status:'ok',...deploymentHealth(c.env),runtime:'native-rer',database:'reachable',files:'reachable'}) }
 catch { return c.json({status:'unavailable',runtime:'native-rer'},503) }
})
app.route('/api/delegation/v1',delegation)
app.route('/api/delegation',nativeDelegation)
app.route('/delegation',consent)
app.route('/api/identity',identity)
app.route('/api/conversations',createConversationRoutes(applyMessageEffects))
app.route('/api/conversations',widgetEvents)
app.route('/api/projects',projectSocketRoutes)
app.route('/api/ai-support',ai)
app.route('/api/knowledge',knowledge)
app.route('/api/customer-context',context)
app.route('/api/training',trainingRoutes)
app.route('/api/management',integrationSettings)
app.route('/api/management',management)
app.route('/api/management',brandMediaRoutes)
app.route('/api/site-preview',sitePreview)
app.route('/preview',previewRoutes)
app.route('/api/integrations',inboundEmail)
app.route('/api/dashboard',dashboardRoutes)
app.route('/api/dashboard',tags)
app.route('/api/move-in',moveInRoutes)
app.route('/api/widget',publicWidget)
registerLocalComputerRoutes(app,localComputerIntegration)

// Drain small rejected uploads so the Worker proxy preserves the HTTP response.
app.notFound(c => notFoundResponse(c.req.raw))
