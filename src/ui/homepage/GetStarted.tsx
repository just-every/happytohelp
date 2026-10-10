import { docsUrl, sourceUrl } from './repository';
import { useReveal } from './reveal/useReveal';

// The closing band echoes the hero: a big headline, and an aqua pen line with one loop drawn in under it.
export function GetStarted() {
  const reveal = useReveal<HTMLHeadingElement>();
  return <section className="section get-started" id="get-started" aria-labelledby="get-started-title">
    <h2 id="get-started-title" ref={reveal}>Ready when you are.<svg className="ready-line" viewBox="0 0 620 64" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path pathLength={1} d="M14 40C120 26 250 20 370 24 420 26 452 32 466 22 480 12 470 2 458 6 444 10 448 32 470 40 510 54 560 46 606 30" />
    </svg></h2>
    <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={docsUrl}>Read the docs</a></div>
  </section>;
}
