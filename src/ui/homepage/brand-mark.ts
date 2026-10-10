// The HappyToHelp mark, drawn by hand as SVG from the owner-chosen 12ui logo: a speech bubble with its tail at the lower
// left, a closed-eye smile and three aqua sparks (the favicon alone leaves the sparks out). This file is the one source of truth for its geometry: the header lockup
// (BrandMark.tsx) draws these paths, the no-project Help Center page draws markSvg() inline, and
// public/homepage/media/brands/happytohelp-mark.svg and happytohelp-favicon.svg are exactly markSvg() and faviconSvg(); the
// PNGs beside them are rendered from those two files.

export const markViewBox = '0 0 110 93';
/** The drawings' cyan (drawings.css --d-cyan); the ink is currentColor, or the page ink in the standalone files. */
export const sparkColour = '#8fe3ee';
const ink = '#141414';
const paper = '#f6f2ea';

export const bubble = 'M49.3 19.3C70.2 19.3 81.8 30.8 81.8 53.2C81.8 71.3 66.3 79.1 44.4 80L24.6 79.6L8 89.5L10.6 74.3C8.5 65.3 4.2 61.8 4.2 47.7C4.2 28.4 17.6 19.3 49.3 19.3Z';
/** Left eye, right eye and smile. */
export const face = ['M24.2 52.7C26.1 45.8 32.5 45.2 35.6 50.2', 'M54.9 47.1C55.1 42.5 62.5 40 64.7 45.5', 'M40.1 60.1C43.6 63.7 51.5 63.7 54.1 57.6'];
export const sparks = ['M80.5 15.3L85 4.4', 'M91.9 27L103.7 19', 'M96 43.7L106.4 45.7'];
export const inkWidth = 6.2;
export const sparkWidth = 6.8;

const paths = (list: string[]) => list.map(d => `<path d="${d}"/>`).join('');
const open = (viewBox: string, size = '') => `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="${viewBox}" fill="none" stroke-linecap="round" stroke-linejoin="round">`;

/** The mark as a standalone file, identical to the header's inline SVG. */
export const markSvg = () => `${open(markViewBox)}<g stroke="currentColor" stroke-width="${inkWidth}"><path d="${bubble}"/>${paths(face)}</g><g stroke="${sparkColour}" stroke-width="${sparkWidth}">${paths(sparks)}</g></svg>\n`;

/**
 * The favicon frames the bubble alone: without the sparks it fills a square viewBox with a thin margin (about 1px at the
 * sides and 2px above and below at 32px; the stroked bubble spans x -0.8..86.8, y 14.3..94.5, the tail tip included).
 */
export const faviconViewBox = '-4.5 6.9 95 95';

/**
 * The favicon's face: the mark's three face strokes, each placed by its own transform so that at 16px the smile is the
 * strongest mark and plainly curves up. Each stroke is scaled about its own centre in the mark (`from`) and centred at
 * `to`, and `width` is its stroke as drawn: the eyes at 84% of the mark, lifted clear of the smile, at a 6.3 stroke; the
 * smile twice as wide and 2.75 times as deep as the mark's, at a heavier 7.6 stroke on average (the uneven scale makes it
 * heaviest along the bottom of the curve).
 */
const faviconFace = [
  { scale: [0.84, 0.84], from: [29.9, 49.8], to: [27, 44.2], width: 6.3 },
  { scale: [0.84, 0.84], from: [59.8, 44.7], to: [60.5, 38.5], width: 6.3 },
  { scale: [2, 2.75], from: [47.1, 60.1], to: [47.5, 58], width: 7.6 },
];
const round = (n: number) => +n.toFixed(2);
const faviconPaths = () => face.map((d, i) => {
  const { scale: [sx, sy], from: [fx, fy], to: [tx, ty], width } = faviconFace[i];
  return `<path d="${d}" transform="matrix(${sx} 0 0 ${sy} ${round(tx - sx * fx)} ${round(ty - sy * fy)})" stroke-width="${round(width / Math.sqrt(sx * sy))}"/>`;
}).join('');

/**
 * The same bubble and face tuned for 16 and 32px tabs: no sparks (they only made the bubble smaller in a tab), a heavier
 * outline, the favicon's face above, and a paper fill inside the bubble so it reads on dark tab bars too. The 64px
 * intrinsic size gives the dashboard's unread-count canvas a fixed size to draw on.
 */
export const faviconSvg = () => `${open(faviconViewBox, ' width="64" height="64"')}<path d="${bubble}" fill="${paper}" stroke="${ink}" stroke-width="10"/><g stroke="${ink}">${faviconPaths()}</g></svg>\n`;
