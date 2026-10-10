import { appearanceColor, appearanceImage } from './appearance-values.js';

/** Public appearance contains display values only, never the rest of project settings. */
export function publicAppearance(settings = {}, projectName = 'Support') {
 const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
 const image = value => appearanceImage(value) ?? '';
 const color = appearanceColor(settings.primary_color || settings.color) ?? '';
 return { name: text(settings.brand_name) || projectName, color, logo_url: image(settings.logo_url), avatar_url: image(settings.avatar_url), brand_image_url: image(settings.brand_image_url), greeting: text(settings.welcome_message, 1000) };
}
const colorChannels = color => color.slice(1).match(/../g).map(x => parseInt(x, 16));
const luminance = channels => channels.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
 .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
export function contrastInk(color) {
 const light = luminance(colorChannels(color));
 return (light + .05) / .05 >= 1.05 / (light + .05) ? '#000000' : '#ffffff';
}
/** Keep a readable accent unchanged; darken lighter accents along their RGB hue toward black. */
export function readableAccentOnWhite(color) {
 const channels = colorChannels(color), maximumLuminance = 1.05 / 4.5 - .05;
 if (luminance(channels) <= maximumLuminance) return color;
 const tone = scale => channels.map(channel => Math.floor(channel * scale));
 // Find the brightest safe 8-bit tone. Evaluate the quantized color so rounding cannot lose AA.
 let safe = 0, unsafe = 1;
 while (unsafe - safe > 1 / 65536) {
  const middle = (safe + unsafe) / 2;
  if (luminance(tone(middle)) <= maximumLuminance) safe = middle;
  else unsafe = middle;
 }
 return '#' + tone(safe).map(channel => channel.toString(16).padStart(2, '0')).join('');
}
/** Saved widget theme overrides are more specific than the workspace's shared accent. */
export function widgetAppearance(brand = {}, settings = {}) {
 const theme = structuredClone(settings.theme || {});
 if (brand.color) {
  const accent = { background: brand.color, color: contrastInk(brand.color) };
  theme.button = { ...theme.button, closed: { ...accent, ...theme.button?.closed } };
  theme.input = { ...theme.input, send: { ...accent, ...theme.input?.send } };
 }
 return { ...settings, theme, brand };
}
