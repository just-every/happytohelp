import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Env, Operator, Agent } from './types';
import { now } from './types';

const encoder = new TextEncoder();
export async function hash(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function secret(): string { return [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function passwordHash(password: string, salt = secret()): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `${salt}:${[...new Uint8Array(bits)].map(x => x.toString(16).padStart(2,'0')).join('')}`;
}
export async function passwordMatches(password: string, saved: string) { return await passwordHash(password, saved.split(':')[0]) === saved; }
export async function json<T extends z.ZodType>(c: Context<Env>, schema: T): Promise<z.infer<T>> {
  if (!c.req.header('content-type')?.includes('application/json')) throw new HTTPException(415, { message: 'JSON required' });
  const reader = c.req.raw.body?.getReader();
  let size = 0; const chunks: Uint8Array[] = [];
  if (reader) while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 65536) { await reader.cancel(); throw new HTTPException(413, { message: 'JSON body too large' }); } chunks.push(next.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HTTPException(400, { message: 'Invalid JSON' }); }
  const parsed = schema.safeParse(value); if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  return parsed.data;
}
export async function findOperator(c: Context<Env>): Promise<Operator | null> {
  const token = getCookie(c, 'h2h_session'); if (!token) return null;
  return c.env.DB.prepare('SELECT o.id,o.email,o.name FROM operators o JOIN sessions s ON s.operator_id=o.id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token), now()).first<Operator>();
}
export const operatorAuth: MiddlewareHandler<Env> = async (c, next) => {
  const operator = await findOperator(c); if (!operator) throw new HTTPException(401, { message: 'Sign in required' });
  if (!['GET','HEAD'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (!origin || origin !== new URL(c.env.APP_ORIGIN ?? c.req.url).origin) throw new HTTPException(403, { message: 'Same-origin request required' });
  }
  c.set('operator', operator); await next();
};
export const agentAuth: MiddlewareHandler<Env> = async (c, next) => {
  const token = c.req.header('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) throw new HTTPException(401, { message: 'Agent credential required' });
  const agent = await c.env.DB.prepare('SELECT id,name,revoked_at FROM agents WHERE token_hash=? AND revoked_at IS NULL').bind(await hash(token)).first<Agent>();
  if (!agent) throw new HTTPException(401, { message: 'Agent credential revoked or invalid' });
  c.set('agent',agent); await c.env.DB.prepare('UPDATE agents SET last_seen_at=? WHERE id=? AND revoked_at IS NULL').bind(now(),agent.id).run(); await next();
};
export const shortText = z.string().trim().min(1).max(500);
export const identifier = z.string().uuid();
