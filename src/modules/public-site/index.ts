/// <reference types="vite/client" />
import { Hono } from 'hono'
import type { AppEnv, Env } from '../../platform/env'
import { helpCenterRoutes, reserved, resolvePublicProject } from './help-center'
import home from './pages/home.html?raw'

export async function isPublicSitePath(path: string, env: Env) {
 if (path === '/' || path.startsWith('/help/') || path.startsWith('/api/public-site/')) return true
 const parts = path.split('/').filter(Boolean)
 if (!parts.length || parts.length > 2 || reserved.has(parts[0])) return false
 let key: string
 try { key = decodeURIComponent(parts[0]) } catch { return false }
 return !!await resolvePublicProject(env, key, true)
}

export const publicSiteRoutes = new Hono<AppEnv>()
publicSiteRoutes.get('/', c => c.html(home))
publicSiteRoutes.route('/', helpCenterRoutes)
