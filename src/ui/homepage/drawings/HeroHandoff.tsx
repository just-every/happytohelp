import { HeroConversation } from './HeroConversation';
import { Drawing } from './Sketch';

// The hero: one conversation the connected agent has already solved, floating on a pale aqua blob. The problem is fixed
// and the reply is written, so the team's only step left is Send. The blob fills the figure's own box, so it never
// reaches past the drawing at any width; its right side stays broad down to the reply, so both glyphs sit inside it.
export function HeroHandoff() {
  return <Drawing className="hero-art" label="Drawing of a HappyToHelp conversation. Maya can't turn on the Spanish version of her store. The agent fixes it: Spanish is live on her store. The reply to Maya is ready, and the next step is to press Send.">
    <svg className="hero-blob" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M5 38C12 22 24 10 36 6 46 3 56 1 65 .5 70 .3 75 1.5 78 4 86 10 92 20 96 30 100 40 100 56 100 68 100 82 99 92 92 97 84 101 50 101 30 99 14 97 0 88 0 73 0 60 1 48 5 38Z" />
    </svg>
    <HeroConversation />
  </Drawing>;
}
