// The HappyToHelp wordmark, drawn by hand as SVG strokes following the letter shapes of Nunito (SIL Open Font License 1.1):
// monoline centre-line strokes with round caps and joins, at the mark's pen weight (within a few percent) so word and mark read as one pen,
// letters set a little tighter than Nunito's own spacing. No font data is embedded; these strokes are the whole of it. This
// file is the one source of truth for the wordmark's geometry: the header and footer lockups (BrandWord.tsx) draw these
// paths, and the no-project Help Center page draws wordSvg() inline. The paths are drawn with a cap height of 70 units and
// the viewBox is 120 units tall, with the cap centre (y = -35) at the middle of the box, so centring the box on the mark
// centres the capitals on it. The box is drawn 0.96em tall, so a unit is 0.008em and the capitals stand 0.56em: the mark
// (1.58em) is a little under three times the cap height.

export const wordViewBox = '0 -95 608.5 120';
export const wordStrokeWidth = 12.92;
/** The drawn box, in em: 0.96em tall (the viewBox's 120 units) and as wide as the viewBox at that scale (608.5 units). */
export const wordHeightEm = 0.96;
export const wordWidthEm = 4.868;

/** Each letter drawn at its own origin, `x` along the baseline (y = 0) from the start of the word. */
export const wordGlyphs = [
  { char: 'H', x: 0, advance: 73.65, d: 'M13.45 -64.99V-5.01M62.8 -64.99V-5.01M13.45 -35.49H62.8' },
  { char: 'a', x: 73.65, advance: 54.99, d: 'M15.86 -42.39C19.05 -43.52 22.44 -43.74 26.61 -43.74C36.94 -43.74 43.09 -39.95 43.09 -31.6V-5.01M43.09 -27.92H32.77C18.67 -27.92 10.03 -23.3 10.03 -15.78C10.03 -9.14 16.21 -4.72 26.31 -4.72C37.23 -4.72 41.9 -9.28 43.09 -16.56' },
  { char: 'p', x: 128.64, advance: 58.88, d: 'M12.11 -43.44V12.86M12.11 -36.65C16.28 -41.7 22.64 -43.64 29.79 -43.64C41.7 -43.64 49.45 -35.68 49.45 -24.23C49.45 -12.58 41.7 -4.82 29.79 -4.82C22.64 -4.82 16.28 -6.76 12.11 -11.8' },
  { char: 'p', x: 187.52, advance: 57.66, d: 'M12.11 -43.44V12.86M12.11 -36.65C16.28 -41.7 22.64 -43.64 29.79 -43.64C41.7 -43.64 49.45 -35.68 49.45 -24.23C49.45 -12.58 41.7 -4.82 29.79 -4.82C22.64 -4.82 16.28 -6.76 12.11 -11.8' },
  { char: 'y', x: 245.18, advance: 38.81, d: 'M7.84 -43.44L25.67 -1.64M44.28 -43.44L19.56 12.86' },
  { char: 'T', x: 283.99, advance: 49.21, d: 'M4.96 -64.29H56M30.48 -64.29V-5.01' },
  { char: 'o', x: 333.2, advance: 54.98, d: 'M28.15 -43.64C39.22 -43.64 46.96 -35.49 46.96 -24.23C46.96 -12.97 39.22 -4.82 28.15 -4.82C17.08 -4.82 9.33 -12.97 9.33 -24.23C9.33 -35.49 17.08 -43.64 28.15 -43.64Z' },
  { char: 'H', x: 388.18, advance: 75.25, d: 'M13.45 -64.99V-5.01M62.8 -64.99V-5.01M13.45 -35.49H62.8' },
  { char: 'e', x: 463.43, advance: 54, d: 'M9.73 -23.5H45.87C45.87 -37.32 40.09 -43.64 28.35 -43.64C15.61 -43.64 9.33 -37.62 9.33 -24.23C9.33 -12.19 16.65 -4.82 28.6 -4.82C32.14 -4.82 36.26 -5.09 39.37 -6.13' },
  { char: 'l', x: 517.43, advance: 32.23, d: 'M12.11 -64.99V-15.19C12.11 -8.53 15.09 -4.82 20.85 -4.82C22.64 -4.82 24.13 -5.01 25.62 -5.4' },
  { char: 'p', x: 549.66, advance: 58.84, d: 'M12.11 -43.44V12.86M12.11 -36.65C16.28 -41.7 22.64 -43.64 29.79 -43.64C41.7 -43.64 49.45 -35.68 49.45 -24.23C49.45 -12.58 41.7 -4.82 29.79 -4.82C22.64 -4.82 16.28 -6.76 12.11 -11.8' },
];

/** The wordmark as an SVG string, the same element BrandWord.tsx renders, for pages served without React. */
export const wordSvg = () => `<svg class="brand-word" viewBox="${wordViewBox}" width="${wordWidthEm}em" height="${wordHeightEm}em" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="${wordStrokeWidth}" stroke-linecap="round" stroke-linejoin="round">${wordGlyphs.map(({ x, d }) => `<path transform="translate(${x} 0)" d="${d}"/>`).join('')}</svg>`;
