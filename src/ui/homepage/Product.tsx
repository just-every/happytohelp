import { ChatWidgetDrawing, HelpCentreDrawing, InboxDrawing, SuggestedReplyDrawing } from './drawings/ProductDrawings';

const parts = [
  { title: 'Chat widget', text: 'Right on your website.', Art: ChatWidgetDrawing },
  { title: 'Shared inbox', text: 'Chat and email, in one place.', Art: InboxDrawing },
  { title: 'Help centre', text: 'Answers customers find themselves.', Art: HelpCentreDrawing },
  { title: 'Suggested replies', text: 'Drafted from your own articles, with sources.', Art: SuggestedReplyDrawing },
];

export function Product() {
  return <section className="section product" id="product" aria-labelledby="product-title">
    <div className="section-head"><h2 id="product-title">The rest of your support desk</h2></div>
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
