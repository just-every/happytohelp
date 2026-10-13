import { env } from 'cloudflare:workers'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { app } from '../app'
import type { Env } from './env'

/** Read native identity through its existing Hono authority, with the real
 * request origin and credentials. Never expose the Worker bindings to clients. */
export async function nativeLoaderResponse(path: '/api/identity/setup' | '/api/identity/session') {
 const request = getRequest()
 let bindings = env as unknown as Env
 if (import.meta.env.DEV && import.meta.env.RER_LOCAL_ORIGIN && bindings.H2H_LOCAL === 'true' && !bindings.RER_INSTALLATION_ID) {
  bindings = { ...bindings, APP_ORIGIN: import.meta.env.RER_LOCAL_ORIGIN }
 }
 setResponseHeader('Cache-Control', 'no-store')
 return app.fetch(new Request(new URL(path, request.url), { headers: request.headers }), bindings)
}

export async function nativeLoaderError(response: Response) {
 const body = await response.json() as { error?: string | { message?: string } }
 return new Error(typeof body.error === 'string' ? body.error : body.error?.message || `Request failed (${response.status})`)
}
