import { Hono } from 'hono'
import type { AppEnv } from '../../platform/env'
import { hashToken,requireActor,requireProject } from '../../platform/auth'
import { accounts } from './accounts'
import { recovery } from './recovery'
import { widget } from './widget'
import { registration } from './registration'
import { setup } from './setup'
export const routes=new Hono<AppEnv>()
routes.route('/',accounts)
routes.route('/',recovery)
routes.route('/',widget)
routes.route('/',registration)
routes.route('/',setup)
routes.get('/session',async c=>c.json(await requireActor(c)))
routes.delete('/session',async c=>{await requireActor(c);const token=c.req.header('Authorization')?.replace(/^Bearer /,'')||c.req.header('Cookie')?.match(/h2h_session=([^;]+)/)?.[1];await c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').bind(Date.now(),await hashToken(token!)).run();return c.json({revoked:true})})
routes.get('/projects/:projectId',async c=>{await requireProject(c,c.req.param('projectId'),true);return c.json(await c.env.DB.prepare('SELECT id,name,widget_key,allowed_origin,created_at FROM projects WHERE id=?').bind(c.req.param('projectId')).first())})

routes.get('/editor-config',async c=>{
 const actor=await requireActor(c);
 if(!actor.projectId||!['owner','admin'].includes(actor.role))return c.json({error:'Project owner or admin required'},403);
 c.header('Cache-Control','no-store');
 const managementOrigin=typeof c.env.RER_MANAGEMENT_ORIGIN==='string'?c.env.RER_MANAGEMENT_ORIGIN:'';
 const installationId=typeof c.env.RER_INSTALLATION_ID==='string'?c.env.RER_INSTALLATION_ID:'';
 return c.json({enabled:Boolean(managementOrigin&&installationId),managementOrigin,installationId});
})
