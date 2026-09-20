import { HTTPException } from 'hono/http-exception';

export function requireValue(value: unknown, message: string, status = 422): asserts value {
  if (!value) throw new HTTPException(status as 400, { message });
}

export function text(value: unknown, limit = 8000): string {
  requireValue(typeof value === 'string' && value.trim() && value.length <= limit, 'Invalid text');
  return value as string;
}

export async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
