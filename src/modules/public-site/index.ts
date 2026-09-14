/// <reference types="vite/client" />
import { Hono } from 'hono'
import type { AppEnv,Env } from '../../platform/env'
import { waitlistRoutes,waitlistForm } from './waitlist'
import { helpCenterRoutes,reserved,resolvePublicProject } from './help-center'
import { demoRoute } from '../site-preview/demo'
import { personalizeHome } from './referrer'
import { escapeHtml } from './html'
const pages=import.meta.glob('./pages/*.html',{query:'?raw',import:'default',eager:true}) as Record<string,string>
const routes:Record<string,string>={'/':'home','/marketing':'home','/pricing':'content-pricing','/waitlist':'waitlist-create'}
for(const section of ['features','resources','company'])for(const key of Object.keys(pages)){const name=key.split('/').pop()!.replace('.html','');if(name.startsWith(section+'-'))routes[`/${section}/${name.slice(section.length+1)}`]=name}
export async function isPublicSitePath(path:string,env:Env){if(routes[path]||path==='/demo'||path.startsWith('/help/')||path.startsWith('/api/public-site/'))return true;const parts=path.split('/').filter(Boolean);if(!parts.length||parts.length>2||reserved.has(parts[0]))return false;let key:string;try{key=decodeURIComponent(parts[0])}catch{return false}return !!await resolvePublicProject(env,key,true)}
export const publicSiteRoutes=new Hono<AppEnv>()
for(const [path,name] of Object.entries(routes))publicSiteRoutes.get(path,async c=>{let html=pages[`./pages/${name}.html`].replaceAll('__NATIVE_ORIGIN__',escapeHtml(new URL(c.req.url).origin));if(name==='home')html=personalizeHome(html,c.req.raw);if(path==='/waitlist')return waitlistForm(c,html);const project=typeof c.env.PUBLIC_WIDGET_PROJECT_ID==='string'?c.env.PUBLIC_WIDGET_PROJECT_ID:'';if(project){const row=await c.env.DB.prepare("SELECT widget_key FROM projects WHERE id=? AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=projects.id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL)").bind(project).first<{widget_key:string}>();if(!row)return c.text('Public widget project is not configured',503);html=html.replace('</body>',`<script src="/widget.js" data-widget-key="${escapeHtml(row.widget_key)}" async></script></body>`)};return c.html(html)})
publicSiteRoutes.get('/demo',demoRoute)
publicSiteRoutes.route('/',waitlistRoutes)
publicSiteRoutes.route('/',helpCenterRoutes)
