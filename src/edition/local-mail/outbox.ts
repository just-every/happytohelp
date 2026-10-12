import type {Env} from '../../platform/env'
import {createMailSender} from './sender.mjs'
import {createD1DevelopmentOutbox, createDevelopmentOutboxHandler} from '../../vendor/base/modules/mail/src/development/index.mjs'
import {localMailOrigin} from './configuration'

export function localMailSender(env: Env) {
 if (!localMailOrigin(env)) return null
 return createMailSender({provider: 'development', mode: 'development'}, {outbox: createD1DevelopmentOutbox({db: env.DB})})
}

function denied() {
 return new Response('Not found', {status: 404, headers: {
  'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
 }})
}

/** Called before public-site lookup: rejected requests must do no database work. */
export async function localOutboxResponse(request: Request, env: Env): Promise<Response | null> {
 const url = new URL(request.url)
 if (url.pathname !== '/__dev/outbox') return url.pathname.startsWith('/__dev/outbox/') ? denied() : null
 const origin = localMailOrigin(env)
 if (!origin) return denied()
 const trusted = new URL(origin)
 if (url.origin !== origin || url.username || url.password || request.headers.get('host') !== trusted.host ||
  (request.headers.has('origin') && request.headers.get('origin') !== origin) || request.headers.get('sec-fetch-site') === 'cross-site') return denied()
 const handler = createDevelopmentOutboxHandler({local: true, origin, outbox: createD1DevelopmentOutbox({db: env.DB})})
 return await handler(request) || denied()
}
