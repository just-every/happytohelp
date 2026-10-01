import { HeroConversation } from './HeroConversation';
import { HeroLocal } from './HeroLocal';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';

// The hero: a conversation whose investigation has already been handled by the connected local agent, drawn in a tilted ink frame.
export function HeroHandoff() {
  return <Drawing className="hero-art" label="Drawing of a HappyToHelp conversation that a local agent has already worked on. Maya Chen asks to change her billing date. An internal note records what the agent found, and the Local panel shows an Investigate task completed by Codex on the team's own computer, verified, with a suggested reply for the team to use and send.">
    <SketchMarks variant="bracket" />
    <SketchMarks variant="tick" />
    <SketchWindow className="hero-window">
      <div className="hero-handoff"><HeroConversation /><HeroLocal /></div>
    </SketchWindow>
    <svg className="d-underline" viewBox="0 0 100 6" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false"><path d="M0 2c20 1 40 3 62 3 14 0 26-1 38-2" vectorEffect="non-scaling-stroke" /></svg>
  </Drawing>;
}
