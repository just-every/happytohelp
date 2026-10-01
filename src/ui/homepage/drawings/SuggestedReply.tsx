import { Icon } from './Icons';

// The AI-suggested reply card with its source chip. Shared by the hero and the product drawings.
export function SuggestedReply() {
  return <div className="d-reply">
    <div className="d-reply-head"><Icon name="sparkle" /><span>Suggested reply</span></div>
    <div className="d-reply-body">
      <p>Yes, you can change your billing date from your account settings. The new date will apply to your next billing cycle.</p>
      <span className="d-chip"><Icon name="link" />Source: Billing FAQ</span>
      <div className="d-reply-actions"><span className="d-btn">Edit</span><span className="d-btn d-btn--ink">Send</span></div>
    </div>
  </div>;
}
