import { Hono } from 'hono';
import type { AppEnv } from '../platform/env';
import { hashToken } from '../platform/auth';
import { id } from '../platform/db';
import { sessionCookie } from '../modules/identity/session';

// Imported only by the explicitly opted-in Vite development server.
export const localOwnerLogin = new Hono<AppEnv>();
localOwnerLogin.post('/api/identity/local-owner-session', async c => {
  const url = new URL(c.req.url);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || c.req.header('Origin') !== url.origin || c.req.header('Sec-Fetch-Site') !== 'same-origin') {
    return c.json({error: 'Local same-origin development request required'}, 403);
  }
  const owners = await c.env.DB.prepare(`SELECT DISTINCT u.id FROM users u
    JOIN memberships m ON m.user_id=u.id
    WHERE m.role='owner' AND NOT EXISTS(SELECT 1 FROM project_settings ps
      WHERE ps.project_id=m.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)`)
    .all<{id: string}>();
  if (owners.results.length !== 1) {
    return c.json({error: 'Local automatic login requires exactly one existing owner. Use normal login or first-owner setup.'}, 409);
  }
  const ownerId = owners.results[0].id;
  const membership = await c.env.DB.prepare(`SELECT m.project_id FROM memberships m
    WHERE m.user_id=? AND m.role='owner' AND NOT EXISTS(SELECT 1 FROM project_settings ps
      WHERE ps.project_id=m.project_id AND json_extract(ps.settings_json,'$.deleted_at') IS NOT NULL)
    ORDER BY m.project_id LIMIT 1`).bind(ownerId).first<{project_id: string}>();
  if (!membership) return c.json({error: 'No active owner workspace'}, 409);
  const token = id() + id();
  await c.env.DB.prepare("INSERT INTO sessions VALUES(?,?,?,'owner',NULL,?,NULL)")
    .bind(await hashToken(token), ownerId, membership.project_id, Date.now() + 86400000).run();
  c.header('Set-Cookie', sessionCookie(token, c.req.url));
  c.header('Cache-Control', 'no-store');
  return c.json({authenticated: true});
});
