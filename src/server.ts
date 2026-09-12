import start from '@tanstack/react-start/server-entry'
import { api, type Bindings } from './backend/index'
export default {
  async fetch(request: Request, env: Bindings, execution: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === '/health' || path.startsWith('/api/')) return api.fetch(request, env, execution)
    return start.fetch(request)
  },
} satisfies ExportedHandler<Bindings>
