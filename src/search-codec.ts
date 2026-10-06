import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

/**
 * Only structured values (arrays, objects and quoted strings) are decoded from the URL. The router's default also turns any
 * text that happens to read as a number into one ("1e3" becomes 1000, "12E4567890" a different code), which
 * silently changes values that must survive exactly: an OAuth `state`, a device authorization code.
 */
const structured = (value: string) => {
  const parsed = JSON.parse(value)
  if (typeof parsed === 'number' || typeof parsed === 'boolean' || parsed === null) throw new Error('plain text is kept as written')
  return parsed
}

export const parseSearch = parseSearchWith(structured)
export const stringifySearch = stringifySearchWith(JSON.stringify, structured)
