import { projectCors } from '../src/platform/cors'
import { Hono } from 'hono'
import { routes as identity } from '../src/modules/identity/routes'
import { routes as conversations,projectSocketRoutes } from '../src/modules/conversations/routes'
export { ConversationSocket } from '../src/modules/conversations/socket'
const app=new Hono();app.use('/api/*',projectCors as any);app.route('/api/identity',identity);app.route('/api/conversations',conversations);app.route('/api/projects',projectSocketRoutes);export default app
