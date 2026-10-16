// The pen strokes under docs page titles: one small family, all in the drawings' pen (ink, monoline, round caps and
// joins), each a little different in shape, length and lift, so no two pages wear the same line. This file is the one
// source of their geometry; DocsTitleStroke.tsx draws them and docs.css sizes them.
//
// Every stroke is drawn in a box 40 units tall, at 1 unit = 1px under a 56px title, so `width` is also its widest
// natural length. Under a title it spans `reach` of the title's width, never more than its natural length (scaled with the
// title's type size), so a short title gets a short line and a long one stays calm.

import type { DocsSection } from './types';

export type TitleStroke = { name: string; width: number; reach: number; d: string };

export const titleStrokeHeight = 40;

export const titleStrokes: readonly TitleStroke[] = [
  { name: 'swell', width: 300, reach: 0.78, d: 'M4 27C52 20 104 16 160 19 206 21.5 248 25 296 15' },
  { name: 'mid-loop', width: 248, reach: 0.72, d: 'M4 30C36 24 72 21 104 22 122 22.5 140 20 142 11 144 3 132 1 127 7 121 15 128 27 150 29 182 32 214 25 244 18' },
  { name: 'flick', width: 222, reach: 0.66, d: 'M4 25C58 22 118 24.5 176 22.5 194 22 205 19 216 7' },
  { name: 'wave', width: 196, reach: 0.6, d: 'M4 23C20 15 38 14 56 21 74 28 92 28 110 21 128 14 146 14 164 21 174 25 184 25 192 21' },
  { name: 'dash', width: 232, reach: 0.7, d: 'M4 24C62 21 124 20 184 22M200 21.5C208 21 216 20.5 226 19.5' },
  { name: 'hook', width: 232, reach: 0.7, d: 'M4 23C70 19.5 146 19 196 21.5 214 22.5 226 26 224 31 222 35 214 35.5 208 33' },
  { name: 'rise', width: 214, reach: 0.62, d: 'M4 31C66 29.5 132 25 210 14' },
  { name: 'end-loop', width: 242, reach: 0.68, d: 'M4 24C60 21 118 20 160 23 180 24.5 200 22 204 13 207 6 200 3 193 5 184 8 184 20 192 26 202 33 220 28 238 20' },
  { name: 'tilde', width: 182, reach: 0.52, d: 'M4 25C30 14 62 14 92 22 122 30 152 28 178 17' },
  { name: 'sag', width: 244, reach: 0.72, d: 'M4 15C72 31 168 31 240 13' },
  { name: 'tick', width: 244, reach: 0.72, d: 'M4 17C12 25 20 29 32 28 90 23 160 19 240 15' },
  { name: 'early-curl', width: 230, reach: 0.7, d: 'M4 28C22 25 42 23 58 23 74 23 86 17 84 9 82 3 72 3 68 9 63 17 70 29 92 29 130 29 178 24 226 19' },
  { name: 'lasso', width: 248, reach: 0.72, d: 'M4 20C78 17 150 17 196 20 218 21.5 230 27 226 33 222 38 206 37 204 30 202 22 220 16 244 13' },
  { name: 'comma', width: 236, reach: 0.7, d: 'M7 10C11 18 19 23.5 36 24.5 90 26.5 156 22.5 232 20' },
  { name: 'double', width: 218, reach: 0.64, d: 'M4 17C70 14 142 15 214 17.5M26 28C78 26 128 25.5 176 27' },
  { name: 'ripple', width: 258, reach: 0.76, d: 'M4 22C14 16 24 16 34 22 44 28 54 28 64 22 72 18.5 80 18.5 88 22 120 24 186 21 254 18' },
  { name: 'arch', width: 226, reach: 0.66, d: 'M4 29C48 13 132 9 222 24' },
  { name: 'step', width: 238, reach: 0.7, d: 'M4 26C40 25 76 25 104 24 112 23.5 116 17 124 17 150 17 190 18 234 16' },
  { name: 'trail', width: 262, reach: 0.74, d: 'M4 21C70 18 140 18 200 21M214 22C224 22.5 236 23 244 23.5M252 24C254 24 256 24 258 24' },
  { name: 'drift', width: 204, reach: 0.6, d: 'M4 18C44 24 88 28 132 26 160 24.5 182 21 200 16' },
];

/** FNV-1a over the slug: a page's starting stroke, the same on every build. */
function hash(slug: string) {
  let value = 0x811c9dc5;
  for (const char of slug) value = Math.imul(value ^ char.codePointAt(0)!, 0x01000193) >>> 0;
  return value;
}

/** Each published page's stroke, by slug. A page takes the stroke its slug hashes to, or the next one no page before it in
 *  the manifest has taken, so every page has its own while there are strokes enough (and always within a section). */
export function assignTitleStrokes(sections: Pick<DocsSection, 'pages'>[]) {
  const assigned = new Map<string, TitleStroke>();
  for (const section of sections) {
    const inSection = new Set<TitleStroke>();
    for (const { slug } of section.pages) {
      const taken = new Set([...assigned.values()]);
      const free = (stroke: TitleStroke) => taken.size < titleStrokes.length ? !taken.has(stroke) : inSection.size >= titleStrokes.length || !inSection.has(stroke);
      let index = hash(slug) % titleStrokes.length;
      while (!free(titleStrokes[index])) index = (index + 1) % titleStrokes.length;
      assigned.set(slug, titleStrokes[index]);
      inSection.add(titleStrokes[index]);
    }
  }
  return assigned;
}
