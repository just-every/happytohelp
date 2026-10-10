import { Icon } from './Icons';
import { InkArrow } from './InkArrow';

// One conversation the connected agent has already solved, as three staggered bubbles: Maya's question, the agent's fix
// beside a code glyph, and the reply to Maya with Send still to press, beside a person glyph. Each loose ink arrow sits
// in the gap above the bubble it points at, so its tip lands on that bubble at every width.
export function HeroConversation() {
  return <div className="hero-thread">
    <div className="hc-row hc-ask">
      <b className="hc-who">Maya</b>
      <p className="hc-bubble">I can’t turn on the Spanish version of my store.</p>
    </div>
    <div className="hc-row hc-fix">
      <InkArrow variant="long" />
      <p className="hc-bubble hc-bubble--fix">Fixed. Spanish is live on Maya’s store.</p>
      <span className="hc-glyph hc-glyph--code"><Icon name="code" /></span>
    </div>
    <div className="hc-row hc-reply">
      <InkArrow variant="short" />
      <div className="hc-bubble hc-composer">
        <p className="hc-text">All done, Maya. Refresh and it’s there.</p>
        <span className="d-btn d-btn--ink hc-send">Send</span>
      </div>
      <span className="hc-glyph"><Icon name="person" /></span>
    </div>
  </div>;
}
