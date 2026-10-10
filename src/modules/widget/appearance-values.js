/** Empty strings reset an override; null means a supplied value is invalid. */
export function appearanceImage(value) {
 if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
 const image = value.trim();
 if (!image) return '';
 if (/\s|%(?![a-f0-9]{2})|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(image)) return null;
 if (/^\/(?!\/)/.test(image)) return image;
 const authority = image.match(/^https?:\/\/([^/?#]+)/i)?.[1];
 if (!authority || authority.includes('@')) return null;
 try {
  const parsed = new URL(image);
  return parsed.hostname && !parsed.username && !parsed.password ? parsed.href : null;
 } catch { return null; }
}

export function appearanceColor(value) {
 if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u001f\u007f]/.test(value)) return null;
 const color = value.trim();
 return color === '' || /^#[a-f0-9]{6}$/i.test(color) ? color : null;
}
