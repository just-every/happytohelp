import { Icon } from './Icons';

// The AI tab of a conversation: the AI's suggestion cards, and the composer where a chosen reply is edited and sent.
export function SuggestedReply() {
  return <div className="d-window sr-panel">
    <div className="sr-agent"><span className="d-avatar">C</span>Casey’s Suggestions</div>
    <div className="sr-card">
      <span className="sr-icon"><Icon name="chat" /></span>
      <span className="sr-content">
        <b>Share the language guide</b>
        <small><strong>Use when:</strong> a customer asks how to add a language</small>
        <span>You can add a language in Store settings › Languages, then publish it. Your customers can switch to it straight away.</span>
        <em className="d-chip"><Icon name="link" />Source: Languages guide</em>
      </span>
    </div>
    <div className="sr-composer"><span>Type your reply…</span><span className="hc-plus"><Icon name="plus" /></span><span className="d-btn d-btn--ink">Send</span></div>
  </div>;
}
