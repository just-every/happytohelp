// The aqua pen stroke under the hero's calls to action: a long swash with one loop. Decoration only. drawings.css draws
// it in once, like a pen, as the page appears, and shows it fully drawn when reduced motion is preferred. Its box keeps
// the viewBox's aspect ratio from the first paint, so the stroke animates without moving anything around it.
export function Flourish({ intro = false }: { intro?: boolean }) {
  return <svg className="hero-flourish" viewBox="0 0 640 150" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path data-intro={intro ? '' : undefined} pathLength={1} d="M8 107C50 60 110 42 160 44 205 46 245 66 280 74 320 82 352 66 356 44 360 20 342 8 322 10 300 12 290 34 298 58 310 95 360 128 430 138 510 148 580 115 630 70" />
  </svg>;
}
