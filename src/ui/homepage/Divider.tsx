import { useReveal } from './reveal/useReveal';

// A full-width aqua pen line, drawn in once, between two sections. Decoration only. Each divider has its own squiggle, a long
// line for wide layouts and a short one for phones, and each keeps its own aspect ratio so its curves stay true.
export const dividerLines = {
  first: { wide: 'M6 84C40 84 52 58 82 54 118 50 150 76 240 76 330 76 380 36 470 36 560 36 640 84 770 84 900 84 960 28 1070 28 1170 28 1220 66 1300 66 1340 66 1370 62 1394 60', short: 'M6 80C26 80 34 58 56 56 80 54 100 76 146 76 192 76 222 34 270 34 316 34 340 66 396 62' },
  second: { wide: 'M6 92C200 100 440 84 660 90 760 93 840 94 900 92 924 92 924 56 900 56 780 54 640 62 520 56 496 56 496 20 520 20 700 18 900 30 1100 26 1240 24 1330 20 1394 24', short: 'M4 92C60 98 170 84 290 92 314 92 314 56 290 56 230 54 180 62 120 56 96 56 96 20 120 20 200 18 290 30 396 24' },
};

export function Divider({ line }: { line: { wide: string; short: string } }) {
  const reveal = useReveal<HTMLDivElement>();
  return <div className="divider" aria-hidden="true" ref={reveal}>
    <svg className="divider-line divider-line--wide" viewBox="0 0 1400 110" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path pathLength={1} d={line.wide} />
    </svg>
    <svg className="divider-line divider-line--short" viewBox="0 0 400 110" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path pathLength={1} d={line.short} />
    </svg>
  </div>;
}
