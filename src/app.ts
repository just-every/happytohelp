import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from './platform/env'
import { projectCors } from './platform/cors'
import { routes as identity } from './modules/identity/routes'
import { createConversationRoutes,projectSocketRoutes } from './modules/conversations/routes'
import { routes as ai } from './modules/ai-support/routes'
import { routes as knowledge } from './modules/knowledge'
import { routes as context } from './modules/customer-context'
import { registerLocalComputerRoutes } from './modules/local-computer'
import { localComputerIntegration } from './modules/local-computer/edition'
import { trainingRoutes } from './modules/training-runs'
import { routes as management,dashboardRoutes,publicWidget,widgetEvents,inboundEmail } from './modules/management'
import { applyMessageEffects } from './message-effects'
import { routes as sitePreview,brandMediaRoutes } from './modules/site-preview/routes'
import { previewRoutes } from './modules/site-preview/proxy'

export const app = new Hono<AppEnv>()
app.use('/api/*', projectCors)
app.onError((error,c) => {
 if(error instanceof HTTPException) return c.json({error:error.message},error.status)
 const status=(error as Error & {status?:number}).status
 if(status && [400,401,403,404,409,413,422,429,503].includes(status)) return c.json({error:error.message},status as 400)
 console.error('Request failed',error.name)
 return c.json({error:'Request failed. Check server diagnostics.'},500)
})
app.get('/health',async c=>{
 try { await Promise.all([c.env.DB.prepare('SELECT 1').first(),c.env.FILES.head('_health_probe')]);return c.json({status:'ok',runtime:'native-rer',database:'reachable',files:'reachable'}) }
 catch { return c.json({status:'unavailable',runtime:'native-rer'},503) }
})
app.route('/api/identity',identity)
app.route('/api/conversations',createConversationRoutes(applyMessageEffects))
app.route('/api/conversations',widgetEvents)
app.route('/api/projects',projectSocketRoutes)
app.route('/api/ai-support',ai)
app.route('/api/knowledge',knowledge)
app.route('/api/customer-context',context)
app.route('/api/training',trainingRoutes)
app.route('/api/management',management)
app.route('/api/management',brandMediaRoutes)
app.route('/api/site-preview',sitePreview)
app.route('/preview',previewRoutes)
app.route('/api/integrations',inboundEmail)
app.route('/api/dashboard',dashboardRoutes)
app.route('/api/widget',publicWidget)
registerLocalComputerRoutes(app,localComputerIntegration)
