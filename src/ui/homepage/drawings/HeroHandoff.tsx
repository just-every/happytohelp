import { HeroConversation } from './HeroConversation';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';

// The hero: one conversation the connected agent has already solved, drawn in a tilted ink frame. The problem is fixed
// and the reply is in the composer, so the team's only step left is Send.
export function HeroHandoff() {
  return <Drawing className="hero-art" label="Drawing of a HappyToHelp conversation. Maya can't turn on the Spanish version of her store. Codex has fixed it: Spanish is live on her store. The reply is ready, and the next step is to press Send.">
    <SketchMarks variant="tick" />
    <SketchWindow className="hero-window"><HeroConversation /></SketchWindow>
    <svg className="d-underline" viewBox="0 0 100 6" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false"><path d="M0 2c20 1 40 3 62 3 14 0 26-1 38-2" vectorEffect="non-scaling-stroke" /></svg>
  </Drawing>;
}
