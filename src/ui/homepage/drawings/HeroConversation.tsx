import { Icon } from './Icons';

// The conversation column of the HappyToHelp inbox: header, the customer's message, the internal note the
// local agent's report leaves behind (its summary and each action with its evidence) and the empty composer.
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
        <b>Maya Chen <small>10:24 AM</small></b>
        <p className="d-message">Hi, can I change my billing date? I need to move it to the 15th instead of the 1st.</p>
      </div>
      <div className="hc-note">
        <b className="hc-note-label"><Icon name="lock" />Internal note<small>10:31 AM</small></b>
        <p>The billing date can be moved to the 15th. The change failed only because the account has an unpaid invoice from September.</p>
        <p><b>Read the billing log</b> <small>billing-2026-09-30.log, lines 212-230</small></p>
        <p><b>Checked the Billing FAQ</b> <small>Change your billing date</small></p>
      </div>
    </div>
    <div className="hc-composer"><span>Type your reply…</span><span className="hc-plus"><Icon name="plus" /></span><span className="d-btn d-btn--ink">Send</span></div>
  </div>;
}
