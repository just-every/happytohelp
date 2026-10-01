import { Icon } from './Icons';

// The AI tab of a conversation: the AI's suggestion cards, and the composer where a chosen reply is edited and sent.
export function SuggestedReply() {
  return <div className="d-window sr-panel">
    <div className="sr-agent"><span className="d-avatar">C</span>Casey’s Suggestions</div>
    <div className="sr-card">
      <span className="sr-icon"><Icon name="chat" /></span>
      <span className="sr-content">
        <b>Explain the change</b>
        <small><strong>Use when:</strong> a customer asks about billing dates</small>
        <span>Yes, you can change your billing date from your account settings. It applies from your next billing cycle.</span>
        <em className="d-chip"><Icon name="link" />Source: Billing FAQ</em>
      </span>
    </div>
    <div className="sr-composer"><span>Type your reply…</span><span className="hc-plus"><Icon name="plus" /></span><span className="d-btn d-btn--ink">Send</span></div>
  </div>;
}
