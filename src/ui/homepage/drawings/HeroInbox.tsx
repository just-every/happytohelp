import { Drawing, SketchMarks, SketchWindow } from './Sketch';
import { SuggestedReply } from './SuggestedReply';

const conversations = [
  { initial: 'M', name: 'Maya Chen', preview: 'Can I change my billing date?', active: true },
  { initial: 'T', name: 'Tom Reyes', preview: 'The widget isn’t loading' },
  { initial: 'P', name: 'Priya Shah', preview: 'Where do I find invoices?' },
  { initial: 'S', name: 'Sam Ortiz', preview: 'Thanks, that worked!' },
];

// The hero: the HappyToHelp inbox with a suggested reply, drawn in a tilted ink frame.
export function HeroInbox() {
  return <Drawing className="hero-art" label="Drawing of the HappyToHelp inbox. A list of four customer conversations sits beside Maya Chen's question about changing her billing date and a suggested reply that cites the Billing FAQ, ready for the team to edit or send.">
    <SketchMarks variant="bracket" />
    <SketchMarks variant="tick" />
    <SketchWindow className="hero-window">
      <div className="hero-inbox">
        <ul className="hero-list">
          {conversations.map(c => <li key={c.name} className={c.active ? 'is-active' : undefined}>
            <span className="d-avatar">{c.initial}</span>
            <span><b>{c.name}</b><small>{c.preview}</small></span>
          </li>)}
        </ul>
        <div className="hero-thread">
          <div className="d-contact"><span className="d-avatar">M</span><span><b>Maya Chen</b><small>maya@example.com · 10:24 AM</small></span></div>
          <p className="d-message">Hi, can I change my billing date? I need to move it to the 15th instead of the 1st.</p>
          <SuggestedReply />
        </div>
      </div>
    </SketchWindow>
    <svg className="d-underline" viewBox="0 0 100 6" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false"><path d="M0 2c20 1 40 3 62 3 14 0 26-1 38-2" vectorEffect="non-scaling-stroke" /></svg>
  </Drawing>;
}
