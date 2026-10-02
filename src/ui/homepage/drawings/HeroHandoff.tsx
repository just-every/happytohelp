import { HeroConversation } from './HeroConversation';
import { HeroLocal } from './HeroLocal';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';

// The hero: a conversation the connected local agent has already solved, drawn in a tilted ink frame. The customer's
// problem is fixed and checked, and the reply is in the composer, so the team's only step left is Send.
export function HeroHandoff() {
  return <Drawing className="hero-art" label="Drawing of a HappyToHelp conversation. Maya Chen cannot turn on the Spanish version of her store. Codex, working on the team's own computer, has published Spanish and checked the store loads in Spanish: the Local panel shows Resolve completed and Verified, an internal note lists each step with its evidence, and the reply is in the composer, ready for the team to send.">
    <SketchMarks variant="bracket" />
    <SketchMarks variant="tick" />
    <SketchWindow className="hero-window">
      <div className="hero-handoff"><HeroConversation /><HeroLocal /></div>
    </SketchWindow>
    <svg className="d-underline" viewBox="0 0 100 6" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false"><path d="M0 2c20 1 40 3 62 3 14 0 26-1 38-2" vectorEffect="non-scaling-stroke" /></svg>
  </Drawing>;
}
