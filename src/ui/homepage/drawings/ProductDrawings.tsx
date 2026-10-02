import { Icon } from './Icons';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';
import { SuggestedReply } from './SuggestedReply';

// The widget as a visitor sees it: who they are talking to, the conversation and the message box.
export function ChatWidgetDrawing() {
  return <Drawing className="product-art" label="Drawing of the chat widget: a customer asks how to add their team and Casey answers.">
    <SketchMarks variant="spark" />
    <SketchWindow bar={false}>
      <div className="chat-art">
        <div className="chat-head"><span className="d-avatar">C</span><b>Casey</b></div>
        <div className="chat-thread">
          <p className="d-bubble chat-visitor">How do I add my team?</p>
          <p className="d-bubble chat-agent">Go to Settings and choose Invite.</p>
        </div>
        <div className="chat-input"><span>Message...</span></div>
      </div>
    </SketchWindow>
  </Drawing>;
}

const rows = [
  { initial: 'M', name: 'Maya Chen', preview: 'Can’t turn on Spanish', active: true },
  { initial: 'T', name: 'Tom Reyes', preview: 'The widget isn’t loading' },
  { initial: 'P', name: 'Priya Shah', preview: 'Where do I change my logo?' },
];

export function InboxDrawing() {
  return <Drawing className="product-art" label="Drawing of the shared inbox with three conversations.">
    <SketchMarks variant="tick" />
    <SketchWindow bar={false}>
      <div className="inbox-art">
        <b className="inbox-title">Inbox</b>
        <ul className="inbox-list">
          {rows.map(r => <li key={r.name} className={r.active ? 'is-active' : undefined}>
            <span className="d-avatar">{r.initial}</span>
            <span className="inbox-text"><b>{r.name}</b><span>{r.preview}</span></span>
          </li>)}
        </ul>
      </div>
    </SketchWindow>
  </Drawing>;
}

const articles = ['Turn on another language', 'Reset your password', 'Invite team members'];

// The published Help Center: the search field, then articles by title.
export function HelpCentreDrawing() {
  return <Drawing className="product-art" label="Drawing of a help centre with a search field and three articles.">
    <SketchMarks variant="sparkle" />
    <SketchWindow bar={false}>
      <div className="d-page help-art">
        <div className="help-search"><Icon name="search" /><span>Search the Help Center</span></div>
        <ul>{articles.map(title => <li key={title}><Icon name="doc" /><b>{title}</b></li>)}</ul>
      </div>
    </SketchWindow>
  </Drawing>;
}

export function SuggestedReplyDrawing() {
  return <Drawing className="product-art reply-art" label="Drawing of a suggested reply drafted from the Languages guide, with its source.">
    <SketchMarks variant="spark" />
    <SuggestedReply />
  </Drawing>;
}
