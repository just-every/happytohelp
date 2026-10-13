import {Hono} from 'hono'
import {consumeJob, runScheduled} from '../src/jobs'
import {routes as knowledge} from '../src/modules/knowledge'
import {enqueueSiteRead} from '../src/modules/management/site-read'

// The production entry points only: the enqueue function, the queue consumer in src/jobs.ts and its scheduler, and
// the product's own knowledge routes (the ones the assistant's search and the owner's Knowledge pages call).
const app = new Hono<any>()
app.route('/api/knowledge', knowledge)

export default {
 async fetch(request: Request, env: any, ctx: any) {
  const url = new URL(request.url), project = url.searchParams.get('project') ?? ''
  if (url.pathname.startsWith('/api/knowledge/')) return app.fetch(request, env, ctx)
  if (url.pathname === '/enqueue') return Response.json({result: await enqueueSiteRead(env, project)})
  if (url.pathname === '/redeliver') { await consumeJob({type: 'site.read', id: project, projectId: project}, env); return new Response('ok') }
  if (url.pathname === '/scheduled') { await runScheduled(env); return new Response('ok') }
  return new Response('site-read test')
 },
 async queue(batch: any, env: any) {
  for (const message of batch.messages) { await consumeJob(message.body, env); message.ack() }
 },
}
