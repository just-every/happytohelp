import { sparks } from '../brand-mark';

// The logo's three aqua sparks (the same paths as the mark in brand-mark.ts), springing from the top-right corner of the
// card they sit on. Decoration only. The viewBox is the sparks' own box plus half the pen; drawings.css seats the point
// (78, 40) of the mark's grid, just inside the bubble's shoulder in the logo, on the card's corner, so the sparks sit above
// and right of it as they do on the mark. Each stroke is measured as length 1, so motion.css can draw it in.
export function Sparks() {
  return <svg className="d-sparks" viewBox="78.5 2.4 29.9 45.3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true" focusable="false">
    {sparks.map(d => <path key={d} d={d} pathLength={1} />)}
  </svg>;
}
