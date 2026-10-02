import { Callout } from './Callout';
import { Icon } from './Icons';

// One column of the HappyToHelp inbox once the agent has finished: the customer's message, the internal note the agent
// leaves behind, and the composer with the reply already in it, waiting for Send.
export function HeroConversation() {
  return <div className="hero-thread">
    <div className="hc-message">
      <Callout n={1} />
      <b className="hc-who">Maya</b>
      <p className="d-message">I can’t turn on the Spanish version of my store.</p>
    </div>
    <div className="hc-note">
      <Callout n={2} />
      <div className="hc-by">
        <span className="d-avatar hc-glyph"><Icon name="codex" /></span>
        <b>Codex</b>
        <Icon name="checkCircle" />
      </div>
      <p>Fixed. Spanish is live on Maya’s store.</p>
    </div>
    <div className="hc-composer">
      <Callout n={3} />
      <p className="hc-text">All done, Maya. Refresh and it’s there.</p>
      <span className="hc-send">
        <span className="d-btn d-btn--ink">Send</span>
        <svg className="hc-ring" viewBox="0 0 100 48" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path vectorEffect="non-scaling-stroke" d="M52 3C26 1.5 4 9 3.5 24 3 39 26 46.5 54 45.5c27-1 43.5-9 42.5-22C95.5 10 76 3.5 46 4.5" /></svg>
      </span>
    </div>
  </div>;
}
