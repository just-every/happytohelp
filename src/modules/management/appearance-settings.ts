import { HTTPException } from 'hono/http-exception'
import { appearanceColor, appearanceImage } from '../widget/appearance-values.js'

/** Validate the entire supplied appearance patch before any settings are written. */
export function appearanceSettings(body: unknown): Record<string, string> {
 if (!body || typeof body !== 'object' || Array.isArray(body)) {
  throw new HTTPException(400, { message: 'Project settings must be an object' })
 }
 const values = body as Record<string, unknown>, result: Record<string, string> = {}
 for (const [key, max] of [['brand_name', 300], ['welcome_message', 1000]] as const) {
  if (!Object.hasOwn(values, key)) continue
  const value = values[key]
  if (typeof value !== 'string' || value.length > max) throw new HTTPException(400, {
   message: `${key} must be text of at most ${max} characters, or empty to reset`,
  })
  result[key] = value.trim()
 }
 for (const key of ['logo_url', 'avatar_url', 'brand_image_url', 'primary_color', 'color']) {
  if (!Object.hasOwn(values, key)) continue
  const image = key.endsWith('_url')
  const value = image ? appearanceImage(values[key]) : appearanceColor(values[key])
  if (value === null) throw new HTTPException(400, {
   message: image
    ? `${key} must be an HTTP(S) or root-relative image URL without credentials, or empty to reset`
    : `${key} must be a six-digit hex color (#RRGGBB), or empty to reset`,
  })
  result[key] = value
 }
 return result
}
