import type {Env} from './env'
import {HTTPException} from 'hono/http-exception'
/** Checks the canonical project and deletion record; missing tables are installation errors. */
export async function isProjectActive(env:Env,projectId:string):Promise<boolean>{return Boolean(await env.DB.prepare("SELECT p.id FROM projects p WHERE p.id=? AND NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=p.id AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL)").bind(projectId).first())}
export async function requireActiveProject(env:Env,projectId:string){if(!await isProjectActive(env,projectId))throw new HTTPException(409,{message:'Project is deleted or unavailable'})}
