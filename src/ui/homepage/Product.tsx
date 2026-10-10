import type { ComponentType } from 'react';

import { ChatWidgetDrawing, HelpCentreDrawing, InboxDrawing, SuggestedReplyDrawing } from './drawings/ProductDrawings';
import { useReveal } from './reveal/useReveal';

const parts = [
  { title: 'Chat widget', text: 'Right on your website.', Art: ChatWidgetDrawing },
  { title: 'Shared inbox', text: 'Chat and email, in one place.', Art: InboxDrawing },
  { title: 'Help centre', text: 'Answers customers find themselves.', Art: HelpCentreDrawing },
  { title: 'Suggested replies', text: 'Drafted from your own articles, with sources.', Art: SuggestedReplyDrawing },
];

// Each part is one moment of the page: its card rises in as the row reaches it (staggered across the row) and then the small
// thing in the card happens.
function Part({ title, text, number, Art }: { title: string; text: string; number: number; Art: ComponentType }) {
  const reveal = useReveal<HTMLLIElement>();
  return <li ref={reveal}>
    <Art />
    <span className="step" aria-hidden="true">{number}</span>
    <h3>{title}</h3>
    <p>{text}</p>
  </li>;
}

export function Product() {
  return <section className="section product" id="product" aria-labelledby="product-title">
    <div className="section-head"><h2 id="product-title">The rest of your support desk</h2></div>
    <ol className="parts">{parts.map((part, index) => <Part key={part.title} number={index + 1} {...part} />)}</ol>
  </section>;
}
