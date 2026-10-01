import { Icon } from './Icons';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';
import { SuggestedReply } from './SuggestedReply';

// The widget as a visitor sees it: the assistant's name and role, a reply time, the conversation and the message box.
export function ChatWidgetDrawing() {
  return <Drawing className="product-art" label="Drawing of the chat widget inside a website: the assistant's name and role and how quickly it responds, a customer asking for help changing a billing date, an answer, and a message box ready to reply.">
    <SketchMarks variant="spark" />
    <SketchWindow bar={false}>
      <div className="chat-art">
        <div className="chat-head"><span className="d-avatar">C</span><span><b>Casey • Support assistant</b><small>Responds instantly</small></span></div>
        <div className="chat-thread">
          <p className="d-bubble chat-visitor">Hi, I can’t change my billing date. Can you help?</p>
          <p className="d-bubble chat-agent">Of course. Which date would you like instead?</p>
        </div>
        <div className="chat-input"><span>Message...</span><Icon name="paperclip" /><span className="chat-send"><Icon name="send" /></span></div>
        <p className="chat-foot">We use <b>Happy</b> to <b>Help</b>!</p>
      </div>
    </SketchWindow>
  </Drawing>;
}

const rows = [
  { initial: 'M', name: 'Maya Chen', time: '10:24', preview: 'Can I change my billing…', tag: 'Assigned to Ana' },
  { initial: 'T', name: 'Tom Reyes', time: '9:17', preview: 'The widget isn’t loading', tag: 'Assigned to AI' },
  { initial: 'P', name: 'Priya Shah', time: '8:42', preview: 'Where do I find invoices?' },
];

export function InboxDrawing() {
  return <Drawing className="product-art" label="Drawing of the shared inbox: a sidebar with Inbox, Contacts, Insights and Settings beside a list of conversations that show who each is assigned to, a person or the AI.">
    <SketchMarks variant="tick" />
    <SketchWindow bar={false} className="inbox-window">
      <div className="inbox-art">
        <ul className="inbox-nav">
          <li className="is-active"><Icon name="inbox" />Inbox<em>3</em></li>
          <li><Icon name="person" />Contacts</li>
          <li><Icon name="sparkle" />Insights</li>
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
  { title: 'Update your billing information', summary: 'Change your card and billing date.' },
  { title: 'Reset your password', summary: 'Get back into your account.' },
  { title: 'Invite team members', summary: 'Add people and choose their roles.' },
];

// The published Help Center: brand, the search form, then articles with their summaries.
export function HelpCentreDrawing() {
  return <Drawing className="product-art" label="Drawing of a published Help Center: a Search the Help Center box with a Search button above three articles about billing, passwords and inviting team members.">
    <SketchMarks variant="sparkle" />
    <SketchWindow bar={false}>
      <div className="d-page help-art">
        <b className="help-brand">Northwind Help Center</b>
        <div className="help-search"><Icon name="search" /><span>Search the Help Center</span><em>Search</em></div>
        <ul>{articles.map(a => <li key={a.title}><Icon name="doc" /><span><b>{a.title}</b><small>{a.summary}</small></span></li>)}</ul>
      </div>
    </SketchWindow>
  </Drawing>;
}

export function SuggestedReplyDrawing() {
  return <Drawing className="product-art reply-art" label="Drawing of an AI-suggested reply in a conversation: a suggestion card with a Use when condition and the reply, citing the Billing FAQ as its source, and a message box where the team edits and sends it.">
    <SketchMarks variant="spark" />
    <SuggestedReply />
  </Drawing>;
}
