import { OfferDrawing } from './drawings/OfferDrawing';

export function HelpBeforeTheyAsk() {
  return <section className="section split split--reverse" id="help-before-they-ask" aria-labelledby="offer-title">
    <div className="split-copy">
      <h2 id="offer-title">Help before they ask</h2>
      <p>Some customers who get stuck never write in. They just leave. When someone seems stuck, the widget offers a hand.</p>
    </div>
    <OfferDrawing />
  </section>;
}
