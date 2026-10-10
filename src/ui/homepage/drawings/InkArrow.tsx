// A loose hand-drawn ink arrow that curls down and lands pointing down-right. Decoration only. It is drawn in tenths of
// an em, so its box is exactly the gap it spans (see drawings.css): the shaft starts at the top edge, under the bubble
// above, and the tip ends 0.15em above the bottom edge, on the bubble below.
const ARROWS = {
  long: { viewBox: '0 0 22 34', shaft: 'M4 1.5C0.5 13 10 24.5 19 32.5', head: 'M18.2 27.1 19 32.5 13.5 32.3' },
  short: { viewBox: '0 0 13 26', shaft: 'M5 1.5C0.5 9 4 18 11 24.5', head: 'M10.3 19 11 24.5 5.5 24.2' },
};

export function InkArrow({ variant }: { variant: keyof typeof ARROWS }) {
  const arrow = ARROWS[variant];
  return <svg className={`hc-arrow hc-arrow--${variant}`} viewBox={arrow.viewBox} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={arrow.shaft} />
    <path d={arrow.head} />
  </svg>;
}
