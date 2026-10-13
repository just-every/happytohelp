import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv, Env } from '../../platform/env'
import { id } from '../../platform/db'
import { scope } from './common'
import { DEFAULT_WORKSPACE_COLOUR } from './workspace-colour'

export const workspaceArtwork = new Hono<AppEnv>()
const prefix = '/projects/:projectId'
export function artworkUrl(projectId: string, artworkId?: string) {
 return artworkId ? `/api/management/projects/${projectId}/artwork/${artworkId}` : null
}
export async function workspaceAppearanceFor(env: Env, projectId: string) {
 const row = await env.DB.prepare('SELECT p.name,p.allowed_origin,s.settings_json FROM projects p LEFT JOIN project_settings s ON s.project_id=p.id WHERE p.id=?').bind(projectId).first<{name:string;allowed_origin:string;settings_json:string|null}>()
 if (!row) throw new HTTPException(404)
 const settings = JSON.parse(row.settings_json || '{}')
 return {website:row.allowed_origin,name:row.name,primaryColor:(settings.primary_color || DEFAULT_WORKSPACE_COLOUR).toLowerCase(),artwork_url:artworkUrl(projectId,settings.sidebar_artwork_id),artwork_enabled:settings.sidebar_artwork_enabled === true}
}
workspaceArtwork.get(`${prefix}/appearance`,async c => c.json({data:await workspaceAppearanceFor(c.env,(await scope(c)).projectId)}))
workspaceArtwork.put(`${prefix}/appearance`,async c => {
 const actor = await scope(c,true), body = await c.req.json()
 if (typeof body.artwork_enabled !== 'boolean') throw new HTTPException(400,{message:'Choose whether to show workspace artwork.'})
 await c.env.DB.prepare("INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,json_object('sidebar_artwork_enabled',json(?)),?) ON CONFLICT(project_id) DO UPDATE SET settings_json=json_set(settings_json,'$.sidebar_artwork_enabled',json(?)),updated_at=excluded.updated_at").bind(actor.projectId,JSON.stringify(body.artwork_enabled),Date.now(),JSON.stringify(body.artwork_enabled)).run()
 return c.json({data:await workspaceAppearanceFor(c.env,actor.projectId)})
})
workspaceArtwork.put(`${prefix}/artwork`,bodyLimit({maxSize:12*1024*1024}),async c => {
 const actor = await scope(c,true), projectId = actor.projectId
 if (c.req.header('Content-Type')?.split(';')[0] !== 'image/png') throw new HTTPException(400,{message:'Choose a PNG image.'})
 const bytes = new Uint8Array(await c.req.arrayBuffer()), view = new DataView(bytes.buffer)
 if (bytes.length < 33 || ![137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value) || String.fromCharCode(...bytes.slice(12,16)) !== 'IHDR') throw new HTTPException(400,{message:'Choose a valid PNG image.'})
 const width = view.getUint32(16), height = view.getUint32(20)
 if (!width || !height || width > 8192 || height > 8192) throw new HTTPException(400,{message:'Image dimensions must be between 1 and 8192 pixels.'})
 const contextHeader = c.req.header('x-h2h-expected-workspace'), expectedArtwork = c.req.header('x-h2h-expected-artwork')
 let expected: {website:string;name:string;primaryColor:string} | undefined
 if (contextHeader !== undefined || expectedArtwork !== undefined) {
  if (contextHeader === undefined || expectedArtwork !== 'none') throw new HTTPException(400,{message:'Supply both workspace artwork guards.'})
  try {
   expected = JSON.parse(decodeURIComponent(contextHeader))
   if (!expected || typeof expected.website !== 'string' || typeof expected.name !== 'string' || typeof expected.primaryColor !== 'string' || expected.website.length > 2000 || expected.name.length > 200 || !/^#[0-9a-f]{6}$/i.test(expected.primaryColor)) throw Error()
  } catch { throw new HTTPException(400,{message:'Invalid workspace artwork context.'}) }
 }
 const source = expected || await workspaceAppearanceFor(c.env,projectId)
 const context = JSON.stringify({website:source.website,name:source.name,primaryColor:source.primaryColor})
 const artworkId = id(), objectKey = `workspace-artwork/${projectId}/${artworkId}`
 const old = await c.env.DB.prepare("SELECT json_extract(settings_json,'$.sidebar_artwork_id') artwork_id FROM project_settings WHERE project_id=?").bind(projectId).first<{artwork_id:string|null}>()
 await c.env.FILES.put(objectKey,bytes,{httpMetadata:{contentType:'image/png'}})
 try {
  await c.env.DB.prepare("INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,'{}',?) ON CONFLICT(project_id) DO NOTHING").bind(projectId,Date.now()).run()
  const query = "UPDATE project_settings SET settings_json=json_set(settings_json,'$.sidebar_artwork_id',?,'$.sidebar_artwork_enabled',json('true'),'$.sidebar_artwork_context',json(?)),updated_at=? WHERE project_id=?"
  const result = expected
   ? await c.env.DB.prepare(query+" AND json_extract(settings_json,'$.sidebar_artwork_id') IS NULL AND lower(coalesce(json_extract(settings_json,'$.primary_color'),'"+DEFAULT_WORKSPACE_COLOUR+"'))=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND allowed_origin=? AND name=?)").bind(artworkId,context,Date.now(),projectId,expected.primaryColor.toLowerCase(),projectId,expected.website,expected.name).run()
   : await c.env.DB.prepare(query).bind(artworkId,context,Date.now(),projectId).run()
  if (!result.meta.changes) throw new HTTPException(409,{message:'The workspace changed before this artwork arrived.'})
 } catch (error) { await c.env.FILES.delete(objectKey); throw error }
 if (old?.artwork_id) await c.env.FILES.delete(`workspace-artwork/${projectId}/${old.artwork_id}`)
 return c.json({data:await workspaceAppearanceFor(c.env,projectId)})
})
workspaceArtwork.get(`${prefix}/artwork/:artworkId`,async c => {
 const actor = await scope(c), artworkId = c.req.param('artworkId')
 const row = await c.env.DB.prepare("SELECT json_extract(settings_json,'$.sidebar_artwork_id') artwork_id FROM project_settings WHERE project_id=?").bind(actor.projectId).first<{artwork_id:string|null}>()
 if (!row?.artwork_id || row.artwork_id !== artworkId) throw new HTTPException(404)
 const object = await c.env.FILES.get(`workspace-artwork/${actor.projectId}/${artworkId}`)
 if (!object) throw new HTTPException(404)
 return new Response(object.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
})
