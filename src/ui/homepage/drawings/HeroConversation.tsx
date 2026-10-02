import { Callout } from './Callout';
import { Icon } from './Icons';

const reply = 'Hi Maya, done. Spanish is live on your store now. It was still saved as a draft, so we published it and checked your shop and checkout in Spanish. Refresh and the switch is there.';

// The conversation column of the HappyToHelp inbox after the local agent has finished: the customer's message, the
// internal note its report leaves behind (summary, then each action with its evidence) and the composer with the
// suggested reply already in it, waiting for Send.
export function HeroConversation() {
  return <div className="hero-thread">
    <div className="hc-head">
      <span className="d-avatar">M</span>
      <span className="hc-who"><b>Maya Chen <em className="d-pill">Open</em></b><small>maya@example.com</small></span>
      <span className="d-btn">Close</span>
      <span className="d-btn d-btn--active"><Icon name="monitor" />Local</span>
    </div>
    <div className="hc-body">
      <div className="hc-message">
        <Callout n={1} />
        <b>Maya Chen <small>10:24 AM</small></b>
        <p className="d-message">Hi, I can’t turn on the Spanish version of my store. The language switch is greyed out and half my customers speak Spanish.</p>
      </div>
      <div className="hc-note">
        <Callout n={2} />
        <div className="hc-by">
          <span className="d-avatar hc-glyph"><Icon name="codex" /></span>
          <b>Codex</b>
          <em className="d-tag">Local agent</em>
          <span className="hc-kind"><Icon name="lock" />Internal note</span>
          <small>10:31 AM</small>
        </div>
        <p>Spanish was set up but still in Draft, which kept the switch greyed out. It is now live and working.</p>
        <p><b>Published Spanish:</b> <small>Store settings › Languages, Spanish changed from Draft to Live</small></p>
        <p><b>Checked the store in Spanish:</b> <small>Home, product and checkout pages load in Spanish</small></p>
      </div>
    </div>
    <div className="hc-composer">
      <p className="hc-text">{reply}</p>
      <div className="hc-actions">
        <span className="hc-plus"><Icon name="plus" /></span>
        <span className="hc-send">
          <Callout n={3} />
          <span className="d-btn d-btn--ink">Send</span>
          <svg className="hc-ring" viewBox="0 0 100 48" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path vectorEffect="non-scaling-stroke" d="M52 3C26 1.5 4 9 3.5 24 3 39 26 46.5 54 45.5c27-1 43.5-9 42.5-22C95.5 10 76 3.5 46 4.5" /></svg>
        </span>
      </div>
    </div>
  </div>;
}
