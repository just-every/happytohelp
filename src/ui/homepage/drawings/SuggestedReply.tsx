import { Icon } from './Icons';

// The AI tab of a conversation: one suggestion drafted from an article, with its source.
export function SuggestedReply() {
  return <div className="d-card sr-panel">
    <div className="sr-head"><Icon name="sparkle" />Suggestions</div>
    <div className="sr-card">
      <p>Add a language in Store settings › Languages, then publish it.</p>
      <em className="d-chip"><Icon name="link" />Source: Languages guide</em>
    </div>
  </div>;
}
