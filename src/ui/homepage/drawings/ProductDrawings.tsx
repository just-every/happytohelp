import { Icon } from './Icons';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';
import { SuggestedReply } from './SuggestedReply';

export function ChatWidgetDrawing() {
  return <Drawing className="product-art" label="Drawing of the chat widget inside a website: a customer asks for help changing a billing date and has a message box ready to reply.">
    <SketchMarks variant="spark" />
    <SketchWindow>
      <div className="d-page chat-art">
        <div className="chat-row"><span className="d-avatar">M</span><p className="d-bubble">Hi, I can’t change my billing date. Can you help?</p></div>
        <div className="chat-input"><span>Type a message…</span><Icon name="send" /></div>
      </div>
    </SketchWindow>
  </Drawing>;
}

const rows = [
  { initial: 'M', name: 'Maya Chen', time: '10:24', preview: 'Can I change my billing…', tag: 'Assigned to Ana' },
  { initial: 'T', name: 'Tom Reyes', time: '9:17', preview: 'The widget isn’t loading', tag: 'Note added' },
  { initial: 'P', name: 'Priya Shah', time: '8:42', preview: 'Where do I find invoices?' },
];

export function InboxDrawing() {
  return <Drawing className="product-art" label="Drawing of the shared inbox: a sidebar with Inbox, Notes, Customers and Settings beside a list of conversations that show who each is assigned to and where a note has been added.">
    <SketchMarks variant="tick" />
    <SketchWindow bar={false} className="inbox-window">
      <div className="inbox-art">
        <ul className="inbox-nav">
          <li className="is-active"><Icon name="inbox" />Inbox</li>
          <li><Icon name="note" />Notes</li>
          <li><Icon name="person" />Customers</li>
          <li><Icon name="gear" />Settings</li>
        </ul>
        <ul className="inbox-list">
          {rows.map(r => <li key={r.name}>
            <span className="d-avatar">{r.initial}</span>
            <span className="inbox-text"><b>{r.name}<time>{r.time}</time></b><small>{r.preview}</small>{r.tag && <em className="d-tag">{r.tag}</em>}</span>
          </li>)}
        </ul>
      </div>
    </SketchWindow>
  </Drawing>;
}

const articles = [
  { title: 'Update your billing information', meta: 'Payments · 4 min read' },
  { title: 'Reset your password', meta: 'Account · 3 min read' },
  { title: 'Invite team members', meta: 'Teams · 5 min read' },
];

export function HelpCentreDrawing() {
  return <Drawing className="product-art" label="Drawing of a help centre: a search box above three published articles about billing, passwords and inviting team members.">
    <SketchMarks variant="sparkle" />
    <SketchWindow bar={false}>
      <div className="d-page help-art">
        <div className="help-search"><Icon name="search" /><span>Search help articles…</span></div>
        <ul>{articles.map(a => <li key={a.title}><Icon name="doc" /><span><b>{a.title}</b><small>{a.meta}</small></span></li>)}</ul>
      </div>
    </SketchWindow>
  </Drawing>;
}

export function SuggestedReplyDrawing() {
  return <Drawing className="product-art reply-art" label="Drawing of an AI-suggested reply that explains how to change a billing date, cites the Billing FAQ as its source and waits for a team member to edit or send it.">
    <SketchMarks variant="spark" />
    <SuggestedReply />
  </Drawing>;
}
