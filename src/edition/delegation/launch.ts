import {Hono} from 'hono'
import type {AppEnv} from '../../platform/env'
import {nativeAccess} from './native-access'
import {text} from './common'
export const nativeDelegation=new Hono<AppEnv>()
nativeDelegation.get('/connections',async c=>{const projectId=text(c.req.query('projectId'),200);await nativeAccess(c,projectId);c.header('Cache-Control','no-store');const clients=await c.env.DB.prepare('SELECT id,origin FROM edition_clients WHERE project_id=? AND enabled=1 ORDER BY id').bind(projectId).all();return c.json({clients:clients.results})})
