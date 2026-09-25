import { Hono } from 'hono'
import { routes as identity } from '../src/modules/identity/routes'
import { routes,brandMediaRoutes } from '../src/modules/site-preview/routes'
import { previewRoutes } from '../src/modules/site-preview/proxy'
import { consumeJob } from '../src/modules/site-preview/brand'
const app=new Hono();app.route('/api/identity',identity);app.route('/api/site-preview',routes);app.route('/api/management',brandMediaRoutes);app.route('/preview',previewRoutes)
export default {fetch:app.fetch,async queue(batch:any,env:any){for(const message of batch.messages){await consumeJob(message.body,env);message.ack()}}}
