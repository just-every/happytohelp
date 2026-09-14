import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken } from '../../platform/auth'
import { safeOrigin } from './proxy'
/** Creates an actual expiring trial project. It grants no operator identity or paid provider work. */
export async function demoRoute(c:Context<AppEnv>){
 if(c.env.PUBLIC_DEMO_ENABLED!=='true'||!c.env.PREVIEW_ORIGIN||!c.env.APP_ORIGIN||c.env.PREVIEW_ORIGIN===c.env.APP_ORIGIN)throw new HTTPException(503,{message:'Public website previews are not configured'})
 const website=c.req.query('website');if(!website)throw new HTTPException(400,{message:'Website is required'});const target=safeOrigin(website),now=Date.now(),key=await hashToken(`demo:${c.req.header('CF-Connecting-IP')||'local'}`)
 await c.env.DB.prepare('INSERT INTO preview_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET requests=CASE WHEN window_start<? THEN 1 ELSE requests+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END').bind(key,now,now-3600000,now-3600000).run();const limit=await c.env.DB.prepare('SELECT requests FROM preview_limits WHERE key=?').bind(key).first<{requests:number}>();if(limit!.requests>3)throw new HTTPException(429,{message:'Website preview limit reached; sign in to continue'})
 const projectId=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID(),widgetKey=crypto.randomUUID()
 await c.env.DB.batch([c.env.DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(projectId,new URL(target).hostname,widgetKey,target,now),c.env.DB.prepare('INSERT INTO preview_grants VALUES(?,?,?,?,?,50,1)').bind(await hashToken(token),projectId,'public-demo',target,now+900000)])
 return c.redirect(`${new URL(String(c.env.PREVIEW_ORIGIN)).origin}/preview/${projectId}/${token}/`,303)
}
