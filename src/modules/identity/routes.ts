import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../../platform/env'
import { hashToken,requireActor,requireProject } from '../../platform/auth'
import { id,requiredString } from '../../platform/db'
import { accounts } from './accounts'
import { recovery } from './recovery'
import { widget } from './widget'
import { registration } from './registration'
export const routes=new Hono<AppEnv>()
routes.route('/',accounts)
routes.route('/',recovery)
routes.route('/',widget)
routes.route('/',registration)
routes.post('/bootstrap',async c=>{
 if(!c.env.BOOTSTRAP_TOKEN||c.req.header('Authorization')!==`Bearer ${c.env.BOOTSTRAP_TOKEN}`)throw new HTTPException(403)
 const b=await c.req.json();const projectId=id(),userId=id(),token=id()+id(),now=Date.now();const email=requiredString(b.email,'email',320),name=requiredString(b.name,'name',200),origin=new URL(requiredString(b.allowedOrigin,'allowedOrigin')).origin
 await c.env.DB.batch([c.env.DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(projectId,name,id(),origin,now),c.env.DB.prepare('INSERT INTO users VALUES(?,?,?,?)').bind(userId,email,name,now),c.env.DB.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(projectId,userId),c.env.DB.prepare("INSERT INTO sessions VALUES(?,?,?,'owner',NULL,?,NULL)").bind(await hashToken(token),userId,projectId,now+86400000)])
 return c.json({projectId,userId,token},201)
})
routes.get('/session',async c=>c.json(await requireActor(c)))
routes.delete('/session',async c=>{await requireActor(c);const token=c.req.header('Authorization')?.replace(/^Bearer /,'')||c.req.header('Cookie')?.match(/h2h_session=([^;]+)/)?.[1];await c.env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').bind(Date.now(),await hashToken(token!)).run();return c.json({revoked:true})})
routes.get('/projects/:projectId',async c=>{await requireProject(c,c.req.param('projectId'),true);return c.json(await c.env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(c.req.param('projectId')).first())})
