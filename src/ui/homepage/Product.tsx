import { ChatWidgetDrawing, HelpCentreDrawing, InboxDrawing, SuggestedReplyDrawing } from './drawings/ProductDrawings';

const parts = [
  { title: 'Chat widget', text: 'Customers reach you from your site or app, and can send files and screenshots.', Art: ChatWidgetDrawing },
  { title: 'Shared inbox', text: 'Chat and email in one place, with assignments, internal notes, saved replies and the customer’s details beside every conversation.', Art: InboxDrawing },
  { title: 'Help centre', text: 'Publish searchable articles so customers find answers themselves.', Art: HelpCentreDrawing },
  { title: 'AI-suggested replies that cite their sources', text: 'Drafted from your own articles. Pick one, edit it and send it.', Art: SuggestedReplyDrawing },
];

export function Product() {
  return <section className="section product" id="product" aria-labelledby="product-title">
    <div className="section-head">
      <h2 id="product-title">The rest of your support desk</h2>
      <p>Chat, email, a help centre and suggested replies, in one shared inbox.</p>
    </div>
    <ol className="parts">
      {parts.map(({ title, text, Art }, index) => <li key={title}>
        <Art />
        <span className="step" aria-hidden="true">{index + 1}</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </li>)}
    </ol>
  </section>;
}
