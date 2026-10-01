import { ChatWidgetDrawing, HelpCentreDrawing, InboxDrawing, SuggestedReplyDrawing } from './drawings/ProductDrawings';

const parts = [
  { title: 'Chat widget', text: 'Customers reach you from your site or app.', Art: ChatWidgetDrawing },
  { title: 'Shared inbox', text: 'Assignments, notes and customer context are kept together.', Art: InboxDrawing },
  { title: 'Help centre', text: 'Publish searchable articles so customers can find answers themselves.', Art: HelpCentreDrawing },
  { title: 'AI-suggested replies that cite their sources', text: 'Your team reviews every suggestion before it is sent.', Art: SuggestedReplyDrawing },
];

export function Product() {
  return <section className="section product" id="product" aria-labelledby="product-title">
    <div className="section-head">
      <h2 id="product-title">The product</h2>
      <p>Four parts that work together, in one open-source workspace.</p>
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
