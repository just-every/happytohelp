import { Blob } from './Blob';
import { Icon } from './Icons';
import { Drawing } from './Sketch';
import { Sparks } from './Sparks';
import { SuggestedReply } from './SuggestedReply';

// The four parts of the desk, each an ink card on its own aqua blob, with no window chrome. Product.tsx makes each item one
// moment of the page; motion.css plays the small thing that happens in each card.

// The widget as a visitor sees it: who they are talking to, the conversation and the message box.
export function ChatWidgetDrawing() {
  return <Drawing className="product-art" label="Drawing of the chat widget: a customer asks how to add their team and Casey answers.">
    <Blob shape="left" />
    <div className="d-card chat-art">
      <div className="chat-head"><span className="d-avatar">C</span><b>Casey</b></div>
      <div className="chat-thread">
        <p className="d-bubble chat-visitor">How do I add my team?</p>
        <p className="d-bubble chat-agent">Go to Settings and choose Invite.</p>
      </div>
      <div className="chat-input"><span>Message...</span></div>
      <Sparks />
    </div>
  </Drawing>;
}

const rows = [
  { initial: 'M', name: 'Maya Chen', preview: 'Can’t turn on Spanish', active: true },
  { initial: 'T', name: 'Tom Reyes', preview: 'The widget isn’t loading' },
  { initial: 'P', name: 'Priya Shah', preview: 'Where do I change my logo?' },
];

export function InboxDrawing() {
  return <Drawing className="product-art" label="Drawing of the shared inbox with three conversations.">
    <Blob shape="right" />
    <div className="d-card inbox-art">
      <b className="inbox-title">Inbox</b>
      <ul className="inbox-list">
        {rows.map(r => <li key={r.name} className={r.active ? 'is-active' : undefined}>
          <span className="d-avatar">{r.initial}</span>
          <span className="inbox-text"><b>{r.name}</b><span>{r.preview}</span></span>
        </li>)}
      </ul>
    </div>
  </Drawing>;
}

const articles = ['Turn on another language', 'Reset your password', 'Invite team members'];

// The published Help Center: the search field, then articles by title.
export function HelpCentreDrawing() {
  return <Drawing className="product-art" label="Drawing of a help centre with a search field and three articles.">
    <Blob shape="pebble" />
    <div className="d-card help-art">
      <div className="help-search"><Icon name="search" /><span className="help-query">Search the Help Center</span></div>
      <ul>{articles.map(title => <li key={title}><Icon name="doc" /><b>{title}</b></li>)}</ul>
      <Sparks />
    </div>
  </Drawing>;
}

export function SuggestedReplyDrawing() {
  return <Drawing className="product-art reply-art" label="Drawing of a suggested reply drafted from the Languages guide, with its source.">
    <Blob shape="long" />
    <SuggestedReply />
  </Drawing>;
}
